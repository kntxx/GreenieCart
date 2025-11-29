import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaShoppingCart,
  FaUser,
  FaBars,
  FaAngleDown,
  FaAngleUp,
  FaTrash,
  FaTimes,
  FaTruck,
  FaCreditCard,
  FaMoneyBillWave,
  FaMobileAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
} from "react-icons/fa";
import { IconContext } from "react-icons";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  writeBatch,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "./firebase";
import "../assets/Cart.css";

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface DeliveryDetails {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  notes: string;
}

type PaymentMethod = "cod" | "gcash" | "card";

interface PopupState {
  show: boolean;
  type: "success" | "error" | "info";
  message: string;
  onClose?: () => void;
}

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [popup, setPopup] = useState<PopupState>({
    show: false,
    type: "info",
    message: "",
  });

  // Show popup helper
  const showPopup = (
    type: PopupState["type"],
    message: string,
    onClose?: () => void
  ) => {
    setPopup({ show: true, type, message, onClose });
  };

  const closePopup = () => {
    const callback = popup.onClose;
    setPopup({ ...popup, show: false });
    if (callback) callback();
  };

  // Checkout modal state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1); // 1: Delivery, 2: Payment, 3: Review
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>({
    fullName: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    notes: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [gcashNumber, setGcashNumber] = useState("");
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    cardName: "",
    expiry: "",
    cvv: "",
  });

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleOrdersDropdown = () => setOrdersDropdownOpen(!ordersDropdownOpen);

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Fetch cart items from Firestore
  useEffect(() => {
    const fetchCartItems = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const cartRef = collection(db, "cart", user.uid, "items");
        const querySnapshot = await getDocs(cartRef);
        const items: CartItem[] = [];
        querySnapshot.forEach((doc) => {
          items.push({
            id: doc.id,
            ...doc.data(),
          } as CartItem);
        });
        setCartItems(items);
      } catch (error) {
        console.error("Error fetching cart items:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCartItems();
  }, []);

  // Remove item from cart
  const handleRemove = async (itemId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await deleteDoc(doc(db, "cart", user.uid, "items", itemId));
      setCartItems(cartItems.filter((item) => item.id !== itemId));
    } catch (error) {
      console.error("Error removing item:", error);
      showPopup("error", "Failed to remove item.");
    }
  };

  // Update quantity locally
  const handleQuantityChange = (id: string, qty: number) => {
    if (qty < 1) return;
    setCartItems(
      cartItems.map((item) =>
        item.id === id ? { ...item, quantity: qty } : item
      )
    );
  };

  // Calculate total price
  const totalPrice = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // Open checkout modal
  const openCheckoutModal = () => {
    if (cartItems.length === 0) {
      showPopup("info", "Your cart is empty!");
      return;
    }
    setShowCheckoutModal(true);
    setCheckoutStep(1);
  };

  // Close checkout modal
  const closeCheckoutModal = () => {
    setShowCheckoutModal(false);
    setCheckoutStep(1);
  };

  // Handle delivery details change
  const handleDeliveryChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setDeliveryDetails((prev) => ({ ...prev, [name]: value }));
  };

  // Validate delivery details
  const validateDelivery = () => {
    const { fullName, phone, address, city, postalCode } = deliveryDetails;
    if (!fullName || !phone || !address || !city || !postalCode) {
      showPopup("error", "Please fill in all required delivery fields.");
      return false;
    }
    return true;
  };

  // Validate payment details
  const validatePayment = () => {
    if (paymentMethod === "gcash") {
      if (!gcashNumber || gcashNumber.length < 11) {
        showPopup("error", "Please enter a valid GCash number (11 digits).");
        return false;
      }
    }
    if (paymentMethod === "card") {
      const { cardNumber, cardName, expiry, cvv } = cardDetails;
      if (!cardNumber || !cardName || !expiry || !cvv) {
        showPopup("error", "Please fill in all card details.");
        return false;
      }
      if (cardNumber.replace(/\s/g, "").length < 16) {
        showPopup("error", "Please enter a valid card number.");
        return false;
      }
    }
    return true;
  };

  // Proceed to next step
  const nextStep = () => {
    if (checkoutStep === 1 && !validateDelivery()) return;
    if (checkoutStep === 2 && !validatePayment()) return;
    setCheckoutStep((prev) => prev + 1);
  };

  // Go back to previous step
  const prevStep = () => {
    setCheckoutStep((prev) => prev - 1);
  };

  // Get payment method label
  const getPaymentLabel = (method: PaymentMethod) => {
    switch (method) {
      case "cod":
        return "Cash on Delivery";
      case "gcash":
        return "GCash";
      case "card":
        return "Credit/Debit Card";
    }
  };

  // Checkout - create order and clear cart
  const handleCheckout = async () => {
    const user = auth.currentUser;
    if (!user) {
      showPopup("error", "Please log in to checkout.", () =>
        navigate("/login")
      );
      return;
    }

    if (cartItems.length === 0) {
      showPopup("info", "Your cart is empty!");
      return;
    }

    setCheckingOut(true);

    try {
      // First, verify stock availability and reduce stock
      for (const item of cartItems) {
        const productRef = doc(db, "products", item.productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          showPopup("error", `Product "${item.name}" no longer exists.`);
          setCheckingOut(false);
          return;
        }

        const productData = productSnap.data();
        if (productData.stock < item.quantity) {
          showPopup(
            "error",
            `Not enough stock for "${item.name}". Available: ${productData.stock}`
          );
          setCheckingOut(false);
          return;
        }
      }

      // Reduce stock for each product
      for (const item of cartItems) {
        const productRef = doc(db, "products", item.productId);
        await updateDoc(productRef, {
          stock: increment(-item.quantity),
        });
      }

      // Create order in /orders/{uid}/items with delivery and payment info
      const orderData = {
        items: cartItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
        total: totalPrice,
        deliveryDetails: deliveryDetails,
        paymentMethod: paymentMethod,
        paymentDetails:
          paymentMethod === "gcash"
            ? { gcashNumber }
            : paymentMethod === "card"
            ? {
                cardLast4: cardDetails.cardNumber.slice(-4),
                cardName: cardDetails.cardName,
              }
            : null,
        status: "pending",
        createdAt: new Date(),
      };

      await addDoc(collection(db, "orders", user.uid, "items"), orderData);

      // Clear cart using batch delete
      const batch = writeBatch(db);
      cartItems.forEach((item) => {
        const itemRef = doc(db, "cart", user.uid, "items", item.id);
        batch.delete(itemRef);
      });
      await batch.commit();

      // Clear local state
      setCartItems([]);
      closeCheckoutModal();

      showPopup("success", "Order placed successfully!", () =>
        navigate("/myorders")
      );
    } catch (error) {
      console.error("Error during checkout:", error);
      showPopup("error", "Checkout failed. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="dashboard">
      {/* Popup Modal */}
      {popup.show && (
        <div className="popup-overlay" onClick={closePopup}>
          <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close" onClick={closePopup}>
              <FaTimes />
            </button>
            <div className={`popup-icon popup-icon-${popup.type}`}>
              {popup.type === "success" && <FaCheckCircle />}
              {popup.type === "error" && <FaExclamationCircle />}
              {popup.type === "info" && <FaInfoCircle />}
            </div>
            <p className="popup-message">{popup.message}</p>
            <div className="popup-actions">
              <button className="popup-btn popup-btn-ok" onClick={closePopup}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={closeSidebar}
      ></div>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <h2 className="sidebar-logo">GreenieCart</h2>
        <IconContext.Provider value={{ style: { marginRight: "10px" } }}>
          <nav>
            <ul>
              <li
                className="home"
                onClick={() => {
                  navigate("/home");
                  closeSidebar();
                }}
              >
                <span className="left">
                  <FaHome />
                  Home
                </span>
              </li>
              <li className="orders" onClick={toggleOrdersDropdown}>
                <span className="left">
                  <FaShoppingCart /> Orders
                </span>
                <span className="orders-arrow">
                  {ordersDropdownOpen ? <FaAngleUp /> : <FaAngleDown />}
                </span>
              </li>
              {ordersDropdownOpen && (
                <ul className="dropdown">
                  <li
                    onClick={() => {
                      navigate("/cart");
                      closeSidebar();
                    }}
                  >
                    Your Cart
                  </li>
                  <li
                    onClick={() => {
                      navigate("/myorders");
                      closeSidebar();
                    }}
                  >
                    Your Orders
                  </li>
                </ul>
              )}
              <li
                className="profile"
                onClick={() => {
                  navigate("/profile");
                  closeSidebar();
                }}
              >
                <span className="left">
                  <FaUser />
                  Profile
                </span>
              </li>
              <li className="signout-btn" onClick={handleSignOut}>
                Sign Out
              </li>
            </ul>
          </nav>
        </IconContext.Provider>
      </aside>

      {/* Main Content */}
      <main className={`main ${sidebarOpen ? "sidebar-open" : ""}`}>
        <IconContext.Provider value={{ style: { marginRight: "8px" } }}>
          <header className="top-navbar">
            <span className="menu-icon" onClick={toggleSidebar}>
              <FaBars />
            </span>
            <h2>YOUR CART</h2>
          </header>

          {/* Cart Section */}
          <div className="cart-container">
            <h3>
              <FaShoppingCart /> Shopping Cart
            </h3>

            {loading ? (
              <p className="loading-text">Loading cart...</p>
            ) : !auth.currentUser ? (
              <div className="empty-cart">
                <p>Please log in to view your cart.</p>
                <button
                  className="login-btn"
                  onClick={() => navigate("/login")}
                >
                  Log In
                </button>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="empty-cart">
                <p>Your cart is empty.</p>
                <button
                  className="continue-btn"
                  onClick={() => navigate("/home")}
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <>
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Subtotal</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((item) => (
                      <tr key={item.id}>
                        <td className="cart-product">
                          <img src={item.image} alt={item.name} />
                          <span>{item.name}</span>
                        </td>
                        <td>₱{item.price.toLocaleString()}</td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(
                                item.id,
                                Number(e.target.value)
                              )
                            }
                          />
                        </td>
                        <td>
                          ₱{(item.price * item.quantity).toLocaleString()}
                        </td>
                        <td>
                          <button
                            className="remove-btn"
                            onClick={() => handleRemove(item.id)}
                          >
                            <FaTimes />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="cart-summary">
                  <h4>Total: ₱{totalPrice.toLocaleString()}</h4>
                  <div className="cart-actions">
                    <button
                      className="continue-btn"
                      onClick={() => navigate("/home")}
                    >
                      Continue Shopping
                    </button>
                    <button
                      className="checkout-btn"
                      onClick={openCheckoutModal}
                      disabled={checkingOut}
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </IconContext.Provider>
      </main>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="checkout-modal-overlay" onClick={closeCheckoutModal}>
          <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeCheckoutModal}>
              <FaTimes />
            </button>

            {/* Progress Steps */}
            <div className="checkout-steps">
              <div className={`step ${checkoutStep >= 1 ? "active" : ""}`}>
                <span className="step-number">1</span>
                <span className="step-label">Delivery</span>
              </div>
              <div
                className={`step-line ${checkoutStep >= 2 ? "active" : ""}`}
              ></div>
              <div className={`step ${checkoutStep >= 2 ? "active" : ""}`}>
                <span className="step-number">2</span>
                <span className="step-label">Payment</span>
              </div>
              <div
                className={`step-line ${checkoutStep >= 3 ? "active" : ""}`}
              ></div>
              <div className={`step ${checkoutStep >= 3 ? "active" : ""}`}>
                <span className="step-number">3</span>
                <span className="step-label">Review</span>
              </div>
            </div>

            {/* Step 1: Delivery Details */}
            {checkoutStep === 1 && (
              <div className="checkout-step-content">
                <h3>
                  <FaTruck /> Delivery Details
                </h3>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    name="fullName"
                    value={deliveryDetails.fullName}
                    onChange={handleDeliveryChange}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={deliveryDetails.phone}
                    onChange={handleDeliveryChange}
                    placeholder="Enter your phone number"
                  />
                </div>
                <div className="form-group">
                  <label>Complete Address *</label>
                  <input
                    type="text"
                    name="address"
                    value={deliveryDetails.address}
                    onChange={handleDeliveryChange}
                    placeholder="House/Unit No., Street, Barangay"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City *</label>
                    <input
                      type="text"
                      name="city"
                      value={deliveryDetails.city}
                      onChange={handleDeliveryChange}
                      placeholder="City"
                    />
                  </div>
                  <div className="form-group">
                    <label>Postal Code *</label>
                    <input
                      type="text"
                      name="postalCode"
                      value={deliveryDetails.postalCode}
                      onChange={handleDeliveryChange}
                      placeholder="Postal Code"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Delivery Notes (Optional)</label>
                  <textarea
                    name="notes"
                    value={deliveryDetails.notes}
                    onChange={handleDeliveryChange}
                    placeholder="Any special instructions for delivery"
                    rows={3}
                  />
                </div>
                <div className="checkout-actions">
                  <button className="cancel-btn" onClick={closeCheckoutModal}>
                    Cancel
                  </button>
                  <button className="next-btn" onClick={nextStep}>
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Payment Method */}
            {checkoutStep === 2 && (
              <div className="checkout-step-content">
                <h3>
                  <FaCreditCard /> Payment Method
                </h3>
                <div className="payment-options">
                  <label
                    className={`payment-option ${
                      paymentMethod === "cod" ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                    />
                    <FaMoneyBillWave className="payment-icon" />
                    <div className="payment-info">
                      <span className="payment-name">Cash on Delivery</span>
                      <span className="payment-desc">
                        Pay when your order arrives
                      </span>
                    </div>
                  </label>
                  <label
                    className={`payment-option ${
                      paymentMethod === "gcash" ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="gcash"
                      checked={paymentMethod === "gcash"}
                      onChange={() => setPaymentMethod("gcash")}
                    />
                    <FaMobileAlt className="payment-icon" />
                    <div className="payment-info">
                      <span className="payment-name">GCash</span>
                      <span className="payment-desc">
                        Pay using your GCash wallet
                      </span>
                    </div>
                  </label>
                  <label
                    className={`payment-option ${
                      paymentMethod === "card" ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="card"
                      checked={paymentMethod === "card"}
                      onChange={() => setPaymentMethod("card")}
                    />
                    <FaCreditCard className="payment-icon" />
                    <div className="payment-info">
                      <span className="payment-name">Credit/Debit Card</span>
                      <span className="payment-desc">
                        Visa, Mastercard, etc.
                      </span>
                    </div>
                  </label>
                </div>

                {/* GCash Number Input */}
                {paymentMethod === "gcash" && (
                  <div className="payment-details-form">
                    <div className="form-group">
                      <label>GCash Number *</label>
                      <input
                        type="tel"
                        value={gcashNumber}
                        onChange={(e) =>
                          setGcashNumber(
                            e.target.value.replace(/\D/g, "").slice(0, 11)
                          )
                        }
                        placeholder="09XX XXX XXXX"
                        maxLength={11}
                      />
                    </div>
                  </div>
                )}

                {/* Card Details Input */}
                {paymentMethod === "card" && (
                  <div className="payment-details-form">
                    <div className="form-group">
                      <label>Card Number *</label>
                      <input
                        type="text"
                        value={cardDetails.cardNumber}
                        onChange={(e) => {
                          const value = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 16);
                          const formatted = value.replace(
                            /(\d{4})(?=\d)/g,
                            "$1 "
                          );
                          setCardDetails({
                            ...cardDetails,
                            cardNumber: formatted,
                          });
                        }}
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>
                    <div className="form-group">
                      <label>Cardholder Name *</label>
                      <input
                        type="text"
                        value={cardDetails.cardName}
                        onChange={(e) =>
                          setCardDetails({
                            ...cardDetails,
                            cardName: e.target.value,
                          })
                        }
                        placeholder="Name on card"
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Expiry Date *</label>
                        <input
                          type="text"
                          value={cardDetails.expiry}
                          onChange={(e) => {
                            let value = e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 4);
                            if (value.length >= 2) {
                              value = value.slice(0, 2) + "/" + value.slice(2);
                            }
                            setCardDetails({ ...cardDetails, expiry: value });
                          }}
                          placeholder="MM/YY"
                          maxLength={5}
                        />
                      </div>
                      <div className="form-group">
                        <label>CVV *</label>
                        <input
                          type="password"
                          value={cardDetails.cvv}
                          onChange={(e) =>
                            setCardDetails({
                              ...cardDetails,
                              cvv: e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 4),
                            })
                          }
                          placeholder="•••"
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="checkout-actions">
                  <button className="back-btn" onClick={prevStep}>
                    Back
                  </button>
                  <button className="next-btn" onClick={nextStep}>
                    Review Order
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review Order */}
            {checkoutStep === 3 && (
              <div className="checkout-step-content">
                <h3>Review Your Order</h3>

                <div className="review-section">
                  <h4>
                    <FaTruck /> Delivery Information
                  </h4>
                  <div className="review-details">
                    <p>
                      <strong>{deliveryDetails.fullName}</strong>
                    </p>
                    <p>{deliveryDetails.phone}</p>
                    <p>{deliveryDetails.address}</p>
                    <p>
                      {deliveryDetails.city}, {deliveryDetails.postalCode}
                    </p>
                    {deliveryDetails.notes && (
                      <p className="notes">Note: {deliveryDetails.notes}</p>
                    )}
                  </div>
                </div>

                <div className="review-section">
                  <h4>
                    <FaCreditCard /> Payment Method
                  </h4>
                  <p className="payment-selected">
                    {getPaymentLabel(paymentMethod)}
                  </p>
                </div>

                <div className="review-section">
                  <h4>
                    <FaShoppingCart /> Order Summary
                  </h4>
                  <div className="order-items-review">
                    {cartItems.map((item) => (
                      <div key={item.id} className="review-item">
                        <img src={item.image} alt={item.name} />
                        <div className="review-item-info">
                          <span className="item-name">{item.name}</span>
                          <span className="item-qty">Qty: {item.quantity}</span>
                        </div>
                        <span className="item-price">
                          ₱{(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="order-total-review">
                    <span>Total:</span>
                    <span className="total-amount">
                      ₱{totalPrice.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="checkout-actions">
                  <button className="back-btn" onClick={prevStep}>
                    Back
                  </button>
                  <button
                    className="place-order-btn"
                    onClick={handleCheckout}
                    disabled={checkingOut}
                  >
                    {checkingOut ? "Processing..." : "Place Order"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;

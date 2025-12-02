import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaShoppingCart,
  FaUser,
  FaBars,
  FaAngleDown,
  FaAngleUp,
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
  type: "success" | "error" | "info" | "confirm";
  message: string;
  onClose?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
}

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [popup, setPopup] = useState<PopupState>({ show: false, type: "info", message: "" });

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails>({
    fullName: "", phone: "", address: "", city: "", postalCode: "", notes: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [gcashNumber, setGcashNumber] = useState("");
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "", cardName: "", expiry: "", cvv: "",
  });

  const showPopup = (
    type: PopupState["type"],
    message: string,
    onClose?: () => void,
    onConfirm?: () => void,
    confirmText?: string
  ) => {
    setPopup({ show: true, type, message, onClose, onConfirm, confirmText });
  };

  const closePopup = () => {
    const callback = popup.onClose;
    setPopup({ ...popup, show: false });
    if (callback) callback();
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleOrdersDropdown = () => setOrdersDropdownOpen(!ordersDropdownOpen);

  const handleSignOut = () => {
    showPopup("confirm", "Are you sure you want to sign out?", undefined, async () => {
      await signOut(auth);
      navigate("/login");
    }, "Sign Out");
  };


  useEffect(() => {
    const fetchCartItems = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const cartRef = collection(db, "cart", user.uid, "items");
        const snapshot = await getDocs(cartRef);
        const items: CartItem[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as CartItem);
        });
        setCartItems(items);
      } catch (error) {
        console.error("Error fetching cart:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCartItems();
  }, []);


  const fetchUserProfileAndFillDelivery = async () => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const addr = data.address || {};

      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      const phone = data.contact || "";

    
      const houseStreet = [addr.houseNo, addr.street].filter(Boolean).join(", ") || "";
      const barangay = addr.barangay ? `Brgy. ${addr.barangay}` : "";
      const city = addr.city || "";
      const province = addr.province || ""; 
      const zip = addr.zipCode ? `${addr.zipCode}` : "";

   
      const addressParts = [
        houseStreet,
        barangay,
        city,
        province,        
        zip
      ].filter(Boolean);

      const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : "";

      setDeliveryDetails({
        fullName: fullName || "",
        phone: phone || "",
        address: fullAddress,
        city: city || "",          
        postalCode: addr.zipCode || "",
        notes: "",
      });
    }
  } catch (err) {
    console.error("Failed to load profile for delivery", err);
  }
};


  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectedCartItems = cartItems.filter(item => selectedItems.has(item.id));
  const totalPrice = selectedCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleRemove = async (itemId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, "cart", user.uid, "items", itemId));
      setCartItems(prev => prev.filter(i => i.id !== itemId));
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    } catch (error) {
      showPopup("error", "Failed to remove item.");
    }
  };

  const handleQuantityChange = (id: string, qty: number) => {
    if (qty < 1) return;
    setCartItems(prev => prev.map(item =>
      item.id === id ? { ...item, quantity: qty } : item
    ));
  };

 
  const openCheckoutModal = () => {
    if (selectedCartItems.length === 0) {
      showPopup("info", "Please select at least one item to checkout.");
      return;
    }
    fetchUserProfileAndFillDelivery(); 
    setShowCheckoutModal(true);
    setCheckoutStep(1);
  };

  const closeCheckoutModal = () => {
    setShowCheckoutModal(false);
    setCheckoutStep(1);
  };

  const handleDeliveryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setDeliveryDetails(prev => ({ ...prev, [name]: value }));
  };

  const validateDelivery = () => {
    const { fullName, phone, address, city, postalCode } = deliveryDetails;
    if (!fullName || !phone || !address || !city || !postalCode) {
      showPopup("error", "Please fill in all required delivery fields.");
      return false;
    }
    return true;
  };

  const validatePayment = () => {
    if (paymentMethod === "gcash" && (gcashNumber.length < 11)) {
      showPopup("error", "Please enter a valid GCash number (11 digits).");
      return false;
    }
    if (paymentMethod === "card") {
      const { cardNumber, cardName, expiry, cvv } = cardDetails;
      if (!cardNumber || !cardName || !expiry || !cvv || cardNumber.replace(/\s/g, "").length < 16) {
        showPopup("error", "Please fill in all card details correctly.");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (checkoutStep === 1 && !validateDelivery()) return;
    if (checkoutStep === 2 && !validatePayment()) return;
    setCheckoutStep(prev => prev + 1);
  };

  const prevStep = () => setCheckoutStep(prev => prev - 1);

  const handleCheckout = async () => {
    const user = auth.currentUser;
    if (!user || selectedCartItems.length === 0) return;

    setCheckingOut(true);

    try {
      // 1. Check stock
      for (const item of selectedCartItems) {
        const productSnap = await getDoc(doc(db, "products", item.productId));
        if (!productSnap.exists()) {
          showPopup("error", `Product "${item.name}" is no longer available.`);
          setCheckingOut(false);
          return;
        }
        if (productSnap.data().stock < item.quantity) {
          showPopup("error", `Not enough stock for "${item.name}".`);
          setCheckingOut(false);
          return;
        }
      }

      // 2. Reduce stock
      const stockBatch = writeBatch(db);
      selectedCartItems.forEach(item => {
        const ref = doc(db, "products", item.productId);
        stockBatch.update(ref, { stock: increment(-item.quantity) });
      });
      await stockBatch.commit();

      // 3. Create order
      const orderData = {
        items: selectedCartItems.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
        total: totalPrice,
        deliveryDetails,
        paymentMethod,
        paymentDetails:
          paymentMethod === "gcash" ? { gcashNumber } :
          paymentMethod === "card" ? { cardLast4: cardDetails.cardNumber.slice(-4), cardName: cardDetails.cardName } :
          null,
        status: "pending",
        createdAt: new Date(),
      };

      await addDoc(collection(db, "orders", user.uid, "items"), orderData);

      // 4. Delete selected items from cart
      const deleteBatch = writeBatch(db);
      selectedCartItems.forEach(item => {
        deleteBatch.delete(doc(db, "cart", user.uid, "items", item.id));
      });
      await deleteBatch.commit();

      // 5. Update local state
      setCartItems(prev => prev.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
      closeCheckoutModal();

      showPopup("success", "Order placed successfully!", () => navigate("/myorders"));
    } catch (error) {
      console.error("Checkout error:", error);
      showPopup("error", "Checkout failed. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="dashboard">
   
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
              {popup.type === "confirm" && <FaExclamationCircle />}
            </div>
            <p className="popup-message">{popup.message}</p>
            <div className="popup-actions">
              {popup.type === "confirm" ? (
                <>
                  <button className="popup-btn popup-btn-cancel" onClick={closePopup}>
                    Cancel
                  </button>
                  <button
                    className="popup-btn popup-btn-confirm"
                    onClick={() => {
                      if (popup.onConfirm) popup.onConfirm();
                      closePopup();
                    }}
                  >
                    {popup.confirmText || "Confirm"}
                  </button>
                </>
              ) : (
                <button className="popup-btn popup-btn-ok" onClick={closePopup}>
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`} onClick={closeSidebar}></div>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
         <div 
  className="sidebar-logo"
  onClick={() => {
    navigate("/home");
    closeSidebar();  
  }}
  style={{ cursor: "pointer" }} 
>
  <img 
    src="/logo.jpg" 
    alt="GreenieCart Logo" 
    className="sidebar-logo-img"
  />
  <span className="sidebar-logo-text">GreenieCart</span>
</div>
        <IconContext.Provider value={{ style: { marginRight: "10px" } }}>
          <nav>
            <ul>
              <li className="home" onClick={() => { navigate("/home"); closeSidebar(); }}>
                <span className="left"><FaHome /> Home</span>
              </li>
              <li className="orders" onClick={toggleOrdersDropdown}>
                <span className="left"><FaShoppingCart /> Orders</span>
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
    <li
      onClick={() => {
        navigate("/orders-received");  
        closeSidebar();
      }}
      style={{  }}
    >
      Orders Received
    </li>
  </ul>
)}
              <li className="profile" onClick={() => { navigate("/profile"); closeSidebar(); }}>
                <span className="left"><FaUser /> Profile</span>
              </li>
              <li className="signout-btn" onClick={handleSignOut}>Sign Out</li>
            </ul>
          </nav>
        </IconContext.Provider>
      </aside>

      {/* Main Content */}
      <main className={`main ${sidebarOpen ? "sidebar-open" : ""}`}>
        <IconContext.Provider value={{ style: { marginRight: "8px" } }}>
          <header className="top-navbar">
            <span className="menu-icon" onClick={toggleSidebar}><FaBars /></span>
            <h2>YOUR CART</h2>
          </header>

          {/* Cart Section */}
          <div className="cart-container">
            <h3><FaShoppingCart /> Shopping Cart</h3>

            {loading ? (
              <p className="loading-text">Loading cart...</p>
            ) : !auth.currentUser ? (
              <div className="empty-cart">
                <p>Please log in to view your cart.</p>
                <button className="login-btn" onClick={() => navigate("/login")}>Log In</button>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="empty-cart">
                <p>Your cart is empty.</p>
                <button className="continue-btn" onClick={() => navigate("/home")}>
                  Continue Shopping
                </button>
              </div>
            ) : (
              <>
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Product</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Subtotal</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((item) => (
                      <tr key={item.id} className={selectedItems.has(item.id) ? "selected-row" : ""}>
                        <td className="checkbox-col">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleItem(item.id)}
                          />
                        </td>
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
                            onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                          />
                        </td>
                        <td>₱{(item.price * item.quantity).toLocaleString()}</td>
                        <td>
                          <button className="remove-btn" onClick={() => handleRemove(item.id)}>
                            <FaTimes />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="cart-summary">
                  <h4>
                    Total ({selectedItems.size} items): ₱{totalPrice.toLocaleString()}
                  </h4>
                  <div className="cart-actions">
                    <button className="continue-btn" onClick={() => navigate("/home")}>
                      Continue Shopping
                    </button>
                    <button
                      className="checkout-btn"
                      onClick={openCheckoutModal}
                      disabled={checkingOut || selectedItems.size === 0}
                    >
                      Checkout Selected ({selectedItems.size})
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </IconContext.Provider>
      </main>

      {/* Checkout Modal — same as before */}
      {showCheckoutModal && (
        <div className="checkout-modal-overlay" onClick={closeCheckoutModal}>
          <div className="checkout-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeCheckoutModal}><FaTimes /></button>

            <div className="checkout-steps">
              <div className={`step ${checkoutStep >= 1 ? "active" : ""}`}>
                <span className="step-number">1</span><span className="step-label">Delivery</span>
              </div>
              <div className={`step-line ${checkoutStep >= 2 ? "active" : ""}`}></div>
              <div className={`step ${checkoutStep >= 2 ? "active" : ""}`}>
                <span className="step-number">2</span><span className="step-label">Payment</span>
              </div>
              <div className={`step-line ${checkoutStep >= 3 ? "active" : ""}`}></div>
              <div className={`step ${checkoutStep >= 3 ? "active" : ""}`}>
                <span className="step-number">3</span><span className="step-label">Review</span>
              </div>
            </div>

            {/* Step 1: Delivery Details (now auto-filled!) */}
            {checkoutStep === 1 && (
              <div className="checkout-step-content">
                <h3><FaTruck /> Delivery Details</h3>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" name="fullName" value={deliveryDetails.fullName} onChange={handleDeliveryChange} placeholder="Enter your full name" />
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input type="tel" name="phone" value={deliveryDetails.phone} onChange={handleDeliveryChange} placeholder="Enter your phone number" />
                </div>
                <div className="form-group">
                  <label>Complete Address *</label>
                  <input type="text" name="address" value={deliveryDetails.address} onChange={handleDeliveryChange} placeholder="House/Unit No., Street, Barangay" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City *</label>
                    <input type="text" name="city" value={deliveryDetails.city} onChange={handleDeliveryChange} placeholder="City" />
                  </div>
                  <div className="form-group">
                    <label>Postal Code *</label>
                    <input type="text" name="postalCode" value={deliveryDetails.postalCode} onChange={handleDeliveryChange} placeholder="Postal Code" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Delivery Notes (Optional)</label>
                  <textarea name="notes" value={deliveryDetails.notes} onChange={handleDeliveryChange} placeholder="Any special instructions for delivery" rows={3} />
                </div>
                <div className="checkout-actions">
                  <button className="cancel-btn" onClick={closeCheckoutModal}>Cancel</button>
                  <button className="next-btn" onClick={nextStep}>Continue to Payment</button>
                </div>
              </div>
            )}

            {/* Step 2 & Step 3 remain exactly the same */}
            {checkoutStep === 2 && (
              <div className="checkout-step-content">
                <h3><FaCreditCard /> Payment Method</h3>
                <div className="payment-options">
                  <label className={`payment-option ${paymentMethod === "cod" ? "selected" : ""}`}>
                    <input type="radio" name="payment" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
                    <FaMoneyBillWave className="payment-icon" />
                    <div className="payment-info">
                      <span className="payment-name">Cash on Delivery</span>
                      <span className="payment-desc">Pay when your order arrives</span>
                    </div>
                  </label>
                  <label className={`payment-option ${paymentMethod === "gcash" ? "selected" : ""}`}>
                    <input type="radio" name="payment" value="gcash" checked={paymentMethod === "gcash"} onChange={() => setPaymentMethod("gcash")} />
                    <FaMobileAlt className="payment-icon" />
                    <div className="payment-info">
                      <span className="payment-name">GCash</span>
                      <span className="payment-desc">Pay using your GCash wallet</span>
                    </div>
                  </label>
                  <label className={`payment-option ${paymentMethod === "card" ? "selected" : ""}`}>
                    <input type="radio" name="payment" value="card" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} />
                    <FaCreditCard className="payment-icon" />
                    <div className="payment-info">
                      <span className="payment-name">Credit/Debit Card</span>
                      <span className="payment-desc">Visa, Mastercard, etc.</span>
                    </div>
                  </label>
                </div>

                {paymentMethod === "gcash" && (
                  <div className="payment-details-form">
                    <div className="form-group">
                      <label>GCash Number *</label>
                      <input
                        type="tel"
                        value={gcashNumber}
                        onChange={(e) => setGcashNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
                        placeholder="09XX XXX XXXX"
                        maxLength={11}
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "card" && (
                  <div className="payment-details-form">
                    <div className="form-group">
                      <label>Card Number *</label>
                      <input
                        type="text"
                        value={cardDetails.cardNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 16);
                          const formatted = value.replace(/(\d{4})(?=\d)/g, "$1 ");
                          setCardDetails({ ...cardDetails, cardNumber: formatted });
                        }}
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>
                    <div className="form-group">
                      <label>Cardholder Name *</label>
                      <input type="text" value={cardDetails.cardName} onChange={(e) => setCardDetails({ ...cardDetails, cardName: e.target.value })} placeholder="Name on card" />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Expiry Date *</label>
                        <input
                          type="text"
                          value={cardDetails.expiry}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, "").slice(0, 4);
                            if (value.length >= 2) value = value.slice(0, 2) + "/" + value.slice(2);
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
                          onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                          placeholder="•••"
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="checkout-actions">
                  <button className="back-btn" onClick={prevStep}>Back</button>
                  <button className="next-btn" onClick={nextStep}>Review Order</button>
                </div>
              </div>
            )}

            {checkoutStep === 3 && (
              <div className="checkout-step-content">
                <h3>Review Your Order</h3>

                <div className="review-section">
                  <h4><FaShoppingCart /> Order Summary ({selectedCartItems.length} items)</h4>
                  <div className="order-items-review">
                    {selectedCartItems.map((item) => (
                      <div key={item.id} className="review-item">
                        <img src={item.image} alt={item.name} />
                        <div className="review-item-info">
                          <span className="item-name">{item.name}</span>
                          <span className="item-qty">Qty: {item.quantity}</span>
                        </div>
                        <span className="item-price">₱{(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="order-total-review">
                    <span>Total:</span>
                    <span className="total-amount">₱{totalPrice.toLocaleString()}</span>
                  </div>
                </div>

                <div className="checkout-actions">
                  <button className="back-btn" onClick={prevStep}>Back</button>
                  <button className="place-order-btn" onClick={handleCheckout} disabled={checkingOut}>
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
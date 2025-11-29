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

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

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
      alert("Failed to remove item.");
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

  // Checkout - create order and clear cart
  const handleCheckout = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please log in to checkout.");
      navigate("/login");
      return;
    }

    if (cartItems.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    setCheckingOut(true);

    try {
      // First, verify stock availability and reduce stock
      for (const item of cartItems) {
        const productRef = doc(db, "products", item.productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          alert(`Product "${item.name}" no longer exists.`);
          setCheckingOut(false);
          return;
        }

        const productData = productSnap.data();
        if (productData.stock < item.quantity) {
          alert(
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

      // Create order in /orders/{uid}/items
      const orderData = {
        items: cartItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
        total: totalPrice,
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

      alert("Order placed successfully!");
      navigate("/myorders");
    } catch (error) {
      console.error("Error during checkout:", error);
      alert("Checkout failed. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="dashboard">
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
                          <FaTrash
                            className="remove-btn"
                            onClick={() => handleRemove(item.id)}
                          />
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
                      onClick={handleCheckout}
                      disabled={checkingOut}
                    >
                      {checkingOut ? "Processing..." : "Proceed to Checkout"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </IconContext.Provider>
      </main>
    </div>
  );
};

export default Cart;

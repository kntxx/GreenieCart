import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaAngleDown,
  FaAngleUp,
  FaHome,
  FaShoppingCart,
  FaUser,
  FaBars,
  FaBox,
  FaTruck,
  FaCreditCard,
  FaMoneyBillWave,
  FaMobileAlt,
  FaChevronDown,
  FaChevronUp,
  FaTimes,
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
} from "react-icons/fa";
import { IconContext } from "react-icons";

import { collection,  query, orderBy, onSnapshot, doc,  updateDoc } from "firebase/firestore";

import { signOut } from "firebase/auth";
import { db, auth } from "./firebase";
import "../assets/MyOrder.css";

// Popup types
interface PopupState {
  show: boolean;
  type: "success" | "error" | "info" | "confirm";
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
}

interface OrderItem {
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

interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  deliveryDetails?: DeliveryDetails;
  paymentMethod?: PaymentMethod;
  status?: string;
  createdAt: Date;
}

const MyOrder: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [popup, setPopup] = useState<PopupState>({
    show: false,
    type: "info",
    message: "",
  });

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleOrdersDropdown = () => setOrdersDropdownOpen(!ordersDropdownOpen);
  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  
  const showPopup = (
    type: PopupState["type"],
    message: string,
    onConfirm?: () => void,
    confirmText?: string
  ) => {
    setPopup({ show: true, type, message, onConfirm, confirmText });
  };

  const closePopup = () => {
    setPopup({ ...popup, show: false });
  };

  
  const handleSignOut = () => {
    showPopup(
      "confirm",
      "Are you sure you want to sign out?",
      async () => {
        try {
          await signOut(auth);
          navigate("/login");
        } catch (error) {
          console.error("Error signing out:", error);
        }
      },
      "Sign Out"
    );
  };

  
useEffect(() => {
  const user = auth.currentUser;
  if (!user) {
    setLoading(false);
    return;
  }

  const ordersRef = collection(db, "orders", user.uid, "items");
  const q = query(ordersRef, orderBy("createdAt", "desc"));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const ordersData: Order[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      ordersData.push({
        id: doc.id,
        items: data.items || [],
        total: data.total || 0,
        deliveryDetails: data.deliveryDetails || null,
        paymentMethod: data.paymentMethod || null,
        status: data.status || "pending",
        createdAt: data.createdAt?.toDate() || new Date(),
      });
    });
    setOrders(ordersData);
    setLoading(false);
  }, (error) => {
    console.error("Error listening to orders:", error);
    setLoading(false);
  });

  
  return () => unsubscribe();
}, []);



 
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

 
  const getPaymentInfo = (method?: PaymentMethod) => {
    switch (method) {
      case "cod":
        return { label: "Cash on Delivery", icon: <FaMoneyBillWave /> };
      case "gcash":
        return { label: "GCash", icon: <FaMobileAlt /> };
      case "card":
        return { label: "Credit/Debit Card", icon: <FaCreditCard /> };
      default:
        return { label: "Not specified", icon: null };
    }
  };

    // MARK AS COMPLETED - Para sa buyer
  const markAsCompleted = async (orderId: string) => {
    showPopup(
      "confirm",
      "Did you receive your order in good condition?",
      async () => {
        try {
          const orderRef = doc(db, "orders", auth.currentUser!.uid, "items", orderId);
          await updateDoc(orderRef, {
            status: "completed",
            completedAt: new Date(),
          });

          showPopup("success", "Thank you! Order marked as completed!");
        } catch (err) {
          console.error("Error marking as completed:", err);
          showPopup("error", "Failed to confirm. Please try again.");
        }
      },
      "Yes, Received!"
    );
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
              {popup.type === "confirm" && <FaExclamationCircle />}
            </div>
            <p className="popup-message">{popup.message}</p>
            <div className="popup-actions">
              {popup.type === "confirm" ? (
                <>
                  <button
                    className="popup-btn popup-btn-cancel"
                    onClick={closePopup}
                  >
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

      
      <main className={`main ${sidebarOpen ? "sidebar-open" : ""}`}>
        <IconContext.Provider value={{ style: { marginRight: "8px" } }}>
          <header className="top-navbar">
            <span className="menu-icon" onClick={toggleSidebar}>
              <FaBars />
            </span>
            <h2>MY ORDERS</h2>
          </header>

        
          <div className="orders-container">
            <h3>
              <FaBox /> Order History
            </h3>

            {loading ? (
              <p className="loading-text">Loading orders...</p>
            ) : !auth.currentUser ? (
              <div className="empty-orders">
                <p>Please log in to view your orders.</p>
                <button
                  className="login-btn"
                  onClick={() => navigate("/login")}
                >
                  Log In
                </button>
              </div>
            ) : orders.length === 0 ? (
              <div className="empty-orders">
                <p>You haven't placed any orders yet.</p>
                <button
                  className="continue-btn"
                  onClick={() => navigate("/home")}
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <div className="orders-list">
                {orders.map((order) => (
                  <div key={order.id} className="order-card">
                    <div
                      className="order-header"
                      onClick={() => toggleOrderDetails(order.id)}
                    >
                      <div className="order-info">
                        <span className="order-id">
                          Order #{order.id.slice(-8).toUpperCase()}
                        </span>
                        <span className="order-date">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                      <div className="order-header-right" data-status={order.status || "pending"}>
  <div className="order-total">
    <span>₱{order.total.toLocaleString()}</span>
  </div>
  <span className="expand-icon">
    {expandedOrder === order.id ? <FaChevronUp /> : <FaChevronDown />}
  </span>
</div>
                    </div>

                   
                    {expandedOrder === order.id && (
                      <div className="order-expanded">
                       
                        {order.deliveryDetails && (
                          <div className="order-section">
                            <h4>
                              <FaTruck /> Delivery Details
                            </h4>
                            <div className="section-content">
                              <p>
                                <strong>
                                  {order.deliveryDetails.fullName}
                                </strong>
                              </p>
                              <p>{order.deliveryDetails.phone}</p>
                              <p>{order.deliveryDetails.address}</p>
                              <p>
                                {order.deliveryDetails.city},{" "}
                                {order.deliveryDetails.postalCode}
                              </p>
                              {order.deliveryDetails.notes && (
                                <p className="delivery-notes">
                                  <em>Note: {order.deliveryDetails.notes}</em>
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Payment Method */}
                        {order.paymentMethod && (
                          <div className="order-section">
                            <h4>
                              <FaCreditCard /> Payment Method
                            </h4>
                            <div className="section-content payment-method-display">
                              {getPaymentInfo(order.paymentMethod).icon}
                              <span>
                                {getPaymentInfo(order.paymentMethod).label}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Order Items */}
                        <div className="order-section">
  <h4>
    Items Ordered
  </h4>
  <div className="order-items">
    {order.items.map((item, index) => (
      <div key={index} className="order-item">
        <img src={item.image} alt={item.name} />
        <div className="item-details">
          <span className="item-name">{item.name}</span>
          <span className="item-price">
            ₱{item.price.toLocaleString()} × {item.quantity}
          </span>
        </div>
        <div className="item-subtotal">
          ₱{(item.price * item.quantity).toLocaleString()}
        </div>
      </div>
    ))}
  </div>

  
  {order.status === "shipped" && (
    <div className="confirm-receipt-wrapper">
      <button
        className="btn-order-received"
        onClick={() => markAsCompleted(order.id)}
      >
        Order Received
      </button>
      <p className="receipt-hint">
        Tap this once you've received and checked your items
      </p>
    </div>
  )}


  {order.status === "completed" && (
  <div className="completed-wrapper">
    <div className="completed-banner">
      <FaCheckCircle className="check-icon" />
      <span className="checkmark-text"></span>
      <span className="completed-message">
        Order completed! Thank you for shopping with us
      </span>
    </div>
  </div>
)}
</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </IconContext.Provider>
      </main>
    </div>
  );
};

export default MyOrder;

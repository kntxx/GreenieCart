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
} from "react-icons/fa";
import { IconContext } from "react-icons";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "./firebase";
import "../assets/MyOrder.css";

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  createdAt: Date;
}

const MyOrder: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Fetch orders from Firestore
  useEffect(() => {
    const fetchOrders = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const ordersRef = collection(db, "orders", user.uid, "items");
        const q = query(ordersRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const ordersData: Order[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          ordersData.push({
            id: doc.id,
            items: data.items || [],
            total: data.total || 0,
            createdAt: data.createdAt?.toDate() || new Date(),
          });
        });
        setOrders(ordersData);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
            <h2>MY ORDERS</h2>
          </header>

          {/* Orders Section */}
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
                    <div className="order-header">
                      <div className="order-info">
                        <span className="order-id">
                          Order #{order.id.slice(-8).toUpperCase()}
                        </span>
                        <span className="order-date">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                      <div className="order-total">
                        <span>Total: ₱{order.total.toLocaleString()}</span>
                      </div>
                    </div>

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

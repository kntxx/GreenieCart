
import { useState, useEffect } from "react";
import { collection, query, where,  onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { FaBoxOpen, FaUser, FaCalendarAlt, FaCheckCircle, FaTimes, FaInfoCircle, FaExclamationCircle, FaHome, FaAngleDown, FaAngleUp, FaShoppingCart, FaBars, FaTruck, FaMoneyBillWave, FaMobileAlt, FaCreditCard } from "react-icons/fa";
import "../assets/OrdersReceived.css";
import { IconContext } from "react-icons";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

interface OrderItem {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerPhone?: string;        
  buyerAddress?: string;      
  buyerNotes?: string;
  productName: string;
  productImage: string;
  quantity: number;
  totalPrice: number;
  status: "pending" | "paid" | "shipped" | "completed";
  orderedAt: any;
  paymentMethod?: "cod" | "gcash" | "card";
}


interface PopupState {
  show: boolean;
  type: "success" | "error" | "info" | "confirm";
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
}

const OrdersReceived = () => {
const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
   const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
   const [popup, setPopup] = useState<PopupState>({
      show: false,
      type: "info",
      message: "",
    });
  

const thisMonth = new Date();
thisMonth.setDate(1);
thisMonth.setHours(0, 0, 0, 0);

const monthlyEarnings = orders
  .filter(o => o.orderedAt?.toDate?.() >= thisMonth)
  .reduce((sum, o) => sum + o.totalPrice, 0);



   
const today = new Date().setHours(0, 0, 0, 0);
const todayOrders = orders.filter(o => 
  o.orderedAt?.toDate?.() >= today
);

const totalSalesToday = todayOrders.reduce((sum, o) => sum + o.totalPrice, 0);
const totalOrders = orders.length;
const pendingToShip = orders.filter(o => o.status === "pending" || o.status === "paid").length;
const completedOrders = orders.filter(o => o.status === "completed").length;
 
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


    const markAsShipped = async (buyerId: string, orderId: string) => {
  showPopup("confirm", "Mark this order as SHIPPED?", async () => {
    try {
      const orderRef = doc(db, "orders", buyerId, "items", orderId);
      await updateDoc(orderRef, {
        status: "shipped",
        shippedAt: new Date(), 
      });

      
      setOrders(prev => prev.map(order => 
        order.id === orderId && order.buyerId === buyerId 
          ? { ...order, status: "shipped" as const }
          : order
      ));

      showPopup("success", "Order marked as shipped!");
    } catch (err) {
      console.error(err);
      showPopup("error", "Failed to update status. Try again.");
    }
  }, "Yes, Ship It");
};

 const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleOrdersDropdown = () => setOrdersDropdownOpen(!ordersDropdownOpen);


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


  const productsQuery = query(
    collection(db, "products"),
    where("createdBy", "==", user.uid)
  );

  const unsubscribeProducts = onSnapshot(productsQuery, async (productsSnap) => {
    const sellerProductIds = productsSnap.docs.map(doc => doc.id);
    if (sellerProductIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const receivedOrders: OrderItem[] = [];
    const unsubscribers: (() => void)[] = [];

   
    const usersQuery = query(collection(db, "users"));
    const usersUnsub = onSnapshot(usersQuery, (usersSnap) => {
    
      unsubscribers.forEach(unsub => unsub());
      unsubscribers.length = 0;

      usersSnap.docs.forEach((userDoc) => {
        const buyerId = userDoc.id;

        const buyerOrdersRef = collection(db, "orders", buyerId, "items");
        const ordersUnsub = onSnapshot(buyerOrdersRef, (ordersSnap) => {
          let buyerName = userDoc.data()?.displayName || "Unknown User";
          let buyerPhone = "";
          let buyerAddress = "";

          ordersSnap.docs.forEach((orderDoc) => {
            const orderData = orderDoc.data();

           
            if (orderData.deliveryDetails?.fullName) {
              buyerName = orderData.deliveryDetails.fullName;
              buyerPhone = orderData.deliveryDetails.phone || "";
              buyerAddress = [
                orderData.deliveryDetails.address,
                orderData.deliveryDetails.city,
                orderData.deliveryDetails.postalCode
              ].filter(Boolean).join(", ");
            }

            const matchingItems = (orderData.items || []).filter((item: any) =>
              sellerProductIds.includes(item.productId)
            );

           
            const existingIndex = receivedOrders.findIndex(
              o => o.id === orderDoc.id && o.buyerId === buyerId
            );
            if (existingIndex > -1) receivedOrders.splice(existingIndex, matchingItems.length);

         
            matchingItems.forEach((item: any) => {
              receivedOrders.push({
                id: orderDoc.id,
                buyerId,
                buyerName,
                buyerPhone,
                buyerAddress,
                buyerNotes: orderData.deliveryDetails?.notes || "",
                productName: item.name,
                productImage: item.image,
                quantity: item.quantity,
                totalPrice: item.price * item.quantity,
                status: (orderData.status || "pending") as OrderItem["status"],
                orderedAt: orderData.createdAt || new Date(),
                paymentMethod: orderData.paymentMethod,
              });
            });
          });

      
          receivedOrders.sort((a, b) =>
            (b.orderedAt?.toMillis?.() || 0) - (a.orderedAt?.toMillis?.() || 0)
          );

          setOrders([...receivedOrders]);
        });

        unsubscribers.push(ordersUnsub);
      });
    });

   
    return () => {
      usersUnsub();
      unsubscribers.forEach(unsub => unsub());
    };
  });

  setLoading(false);

  return () => unsubscribeProducts();
}, []);
  

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

    <div className="main">
      <header className="top-navbar">
        <span className="menu-icon" onClick={toggleSidebar}>
    <FaBars />
  </span>


        <h2>Orders Received</h2>
      </header>




  <div className="summary-cards">
  <div className="summary-card total-sales">
    <div className="summary-icon">₱</div>
    <div className="summary-info">
      <span className="summary-label">Total Sales Today</span>
      <span className="summary-value">₱{totalSalesToday.toLocaleString()}</span>
    </div>
  </div>


<div className="summary-card monthly-earnings">
  <div className="summary-icon">Chart</div>
  <div className="summary-info">
    <span className="summary-label">This Month</span>
    <span className="summary-value">₱{monthlyEarnings.toLocaleString()}</span>
  </div>
</div>

  <div className="summary-card pending-orders">
    <div className="summary-icon pending">!</div>
    <div className="summary-info">
      <span className="summary-label">Pending to Ship</span>
      <span className="summary-value">{pendingToShip}</span>
    </div>
  </div>

  <div className="summary-card total-orders">
    <div className="summary-icon"><FaShoppingCart /></div>
    <div className="summary-info">
      <span className="summary-label">Total Orders</span>
      <span className="summary-value">{totalOrders}</span>
    </div>
  </div>

  <div className="summary-card completed-orders">
    <div className="summary-icon success"><FaCheckCircle /></div>
    <div className="summary-info">
      <span className="summary-label">Completed</span>
      <span className="summary-value">{completedOrders}</span>
    </div>
  </div>
</div>


      <div className="orders-container">
          {loading ? (
            <p className="loading-text">Loading orders...</p>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <FaBoxOpen size={64} color="#8e8e93" />
              <p>No one has ordered your products yet.</p>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order.id} className="order-card">
                 
                  <div className="order-header">
                    <div className="buyer-info">
                      <FaUser color="#8e8e93" />
                      <div className="buyer-details">
                        <span className="buyer-name">{order.buyerName}</span>
                        <span className="buyer-address">
                          {order.buyerAddress || "Address not provided"}
                        </span>


                         {order.buyerNotes && (
                        <div className="delivery-notes">
                         <strong>Note:</strong> {order.buyerNotes}
                        </div>
                      )}
                      </div>
                    </div>



                    <div className="order-date">
                      <FaCalendarAlt color="#8e8e93" />
                      <span>{order.orderedAt?.toDate().toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}</span>
                    </div>
                  </div>

                  {/* Product */}
              <div className="order-product">
  <img src={order.productImage} alt={order.productName} />

  <div className="product-info">
    <h4>{order.productName}</h4>
    <p className="quantity-text">
      Qty: {order.quantity} × ₱{(order.totalPrice / order.quantity).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
    </p>


    {order.paymentMethod && (
      <div className="payment-method-display">
        {order.paymentMethod === "cod" && <><FaMoneyBillWave /> Cash on Delivery</>}
        {order.paymentMethod === "gcash" && <><FaMobileAlt /> GCash</>}
        {order.paymentMethod === "card" && <><FaCreditCard /> Credit/Debit Card</>}
      </div>
    )}
  </div>


  <div className="product-total">
    ₱{order.totalPrice.toLocaleString()}
  </div>
</div>

                  
<div className="order-footer">
  <div className="order-status">
    <span className={`status-badge ${order.status}`}>
      {order.status === "completed" ? "COMPLETED" : order.status.toUpperCase()}
    </span>
  </div>

 
  {order.status === "pending" || order.status === "paid" ? (
    <button
      className="btn-ship"
      onClick={() => markAsShipped(order.buyerId, order.id)}
    >
      <FaTruck /> Mark as Shipped
    </button>
  ) : order.status === "shipped" ? (
    <span className="shipped-note">Waiting for buyer confirmation...</span>
  ) : order.status === "completed" ? (
    <span className="completed-note">
      <FaCheckCircle /> Order Completed
    </span>
  ) : null}
</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersReceived;
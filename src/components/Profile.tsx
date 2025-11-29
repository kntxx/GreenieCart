import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaAngleDown,
  FaAngleUp,
  FaHome,
  FaShoppingCart,
  FaUser,
  FaBars,
  FaEdit,
  FaTrash,
  FaBoxOpen,
  FaDollarSign,
  FaChartLine,
  FaSave,
  FaTimes,
} from "react-icons/fa";
import { signOut, updateProfile } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "../assets/Profile.css";
import { IconContext } from "react-icons";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  createdBy: string;
}

interface Order {
  id: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  total: number;
  createdAt: Date;
}

interface UserData {
  firstName: string;
  lastName: string;
  contact: string;
  email: string;
  userId: string;
  address?: string;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  // User data from Firestore
  const [userData, setUserData] = useState<UserData>({
    firstName: "",
    lastName: "",
    contact: "",
    email: "",
    userId: "",
    address: "",
  });

  // Edit form data
  const [editData, setEditData] = useState<UserData>({
    firstName: "",
    lastName: "",
    contact: "",
    email: "",
    userId: "",
    address: "",
  });

  // User's products
  const [myProducts, setMyProducts] = useState<Product[]>([]);

  // User's orders (purchases)
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
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

  // Fetch user data, products, and orders
  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const userInfo: UserData = {
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            contact: data.contact || "",
            email: data.email || user.email || "",
            userId: data.userId || "",
            address: data.address || "",
          };
          setUserData(userInfo);
          setEditData(userInfo);
        } else {
          // Fallback to auth data if no Firestore doc
          setUserData({
            firstName: user.displayName?.split(" ")[0] || "",
            lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
            contact: "",
            email: user.email || "",
            userId: "",
            address: "",
          });
        }

        // Fetch user's products
        const productsQuery = query(
          collection(db, "products"),
          where("createdBy", "==", user.uid)
        );
        const productsSnapshot = await getDocs(productsQuery);
        const productsData: Product[] = [];
        productsSnapshot.forEach((doc) => {
          productsData.push({
            id: doc.id,
            ...doc.data(),
          } as Product);
        });
        setMyProducts(productsData);

        // Fetch user's orders
        const ordersRef = collection(db, "orders", user.uid, "items");
        const ordersSnapshot = await getDocs(ordersRef);
        const ordersData: Order[] = [];
        ordersSnapshot.forEach((doc) => {
          ordersData.push({
            id: doc.id,
            ...doc.data(),
          } as Order);
        });
        setMyOrders(ordersData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle edit input change
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Validate contact - only numbers, max 11 digits
    if (name === "contact") {
      if (!/^\d*$/.test(value) || value.length > 11) return;
    }

    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Validate
    if (!editData.firstName.trim() || !editData.lastName.trim()) {
      alert("First name and last name are required.");
      return;
    }

    if (
      editData.contact &&
      (editData.contact.length !== 11 || !editData.contact.startsWith("09"))
    ) {
      alert("Contact number must be 11 digits starting with 09.");
      return;
    }

    setSaving(true);

    try {
      // Update Firestore
      await updateDoc(doc(db, "users", user.uid), {
        firstName: editData.firstName.trim(),
        lastName: editData.lastName.trim(),
        contact: editData.contact,
        address: editData.address?.trim() || "",
        updatedAt: new Date(),
      });

      // Update Firebase Auth display name
      await updateProfile(user, {
        displayName: `${editData.firstName.trim()} ${editData.lastName.trim()}`,
      });

      setUserData(editData);
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditData(userData);
    setIsEditing(false);
  };

  // Delete product handler
  const handleDeleteProduct = async (
    productId: string,
    productName: string
  ) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${productName}"?`
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "products", productId));
      setMyProducts(myProducts.filter((p) => p.id !== productId));
      alert("Product deleted successfully!");
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Failed to delete product.");
    }
  };

  // Calculate stats
  const totalProducts = myProducts.length;
  const totalOrders = myOrders.length;
  const totalSpent = myOrders.reduce((acc, order) => acc + order.total, 0);

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
        {/* Top Navbar */}
        <header className="top-navbar">
          <span className="menu-icon" onClick={toggleSidebar}>
            <FaBars />
          </span>
          <h2>MY PROFILE</h2>
        </header>

        {loading ? (
          <div className="loading-message">Loading profile...</div>
        ) : (
          <>
            {/* User Profile Info */}
            <section className="profile-container">
              <div className="profile-header-row">
                <div className="profile-user-block">
                  <img
                    className="profile-avatar"
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                      `${userData.firstName} ${userData.lastName}`
                    )}&background=166534&color=fff&size=120`}
                    alt="User Avatar"
                  />

                  <div className="profile-user-text">
                    <h3>
                      {userData.firstName} {userData.lastName}
                    </h3>
                    <p className="email">{userData.email}</p>
                    {userData.userId && (
                      <p className="user-id">ID: {userData.userId}</p>
                    )}
                  </div>
                </div>

                {!isEditing ? (
                  <button
                    className="edit-profile-btn"
                    onClick={() => setIsEditing(true)}
                  >
                    <FaEdit /> Edit Profile
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button
                      className="save-btn"
                      onClick={handleSaveProfile}
                      disabled={saving}
                    >
                      <FaSave /> {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      <FaTimes /> Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Profile Details */}
              <div className="profile-details">
                {isEditing ? (
                  // Edit Mode
                  <div className="profile-edit-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label>First Name</label>
                        <input
                          type="text"
                          name="firstName"
                          value={editData.firstName}
                          onChange={handleEditChange}
                          placeholder="Enter first name"
                        />
                      </div>
                      <div className="form-group">
                        <label>Last Name</label>
                        <input
                          type="text"
                          name="lastName"
                          value={editData.lastName}
                          onChange={handleEditChange}
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Contact Number</label>
                        <input
                          type="text"
                          name="contact"
                          value={editData.contact}
                          onChange={handleEditChange}
                          placeholder="09XXXXXXXXX"
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          name="email"
                          value={editData.email}
                          disabled
                          className="disabled-input"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group full-width">
                        <label>Address</label>
                        <input
                          type="text"
                          name="address"
                          value={editData.address || ""}
                          onChange={handleEditChange}
                          placeholder="Enter your address"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="profile-display-grid">
                    <div className="display-row">
                      <label>First Name</label>
                      <p>{userData.firstName || "—"}</p>
                    </div>
                    <div className="display-row">
                      <label>Last Name</label>
                      <p>{userData.lastName || "—"}</p>
                    </div>
                    <div className="display-row">
                      <label>Contact Number</label>
                      <p>{userData.contact || "—"}</p>
                    </div>
                    <div className="display-row">
                      <label>Email</label>
                      <p>{userData.email || "—"}</p>
                    </div>
                   
                  </div>
                )}
              </div>
            </section>

            {/* Stats Cards */}
            <div className="profile-stats">
              <div className="stats-card">
                <span className="stats-icon">
                  <FaBoxOpen />
                </span>
                <h3>My Products</h3>
                <p>{totalProducts}</p>
              </div>

              <div className="stats-card">
                <span className="stats-icon">
                  <FaShoppingCart />
                </span>
                <h3>My Orders</h3>
                <p>{totalOrders}</p>
              </div>

              <div className="stats-card">
                <span className="stats-icon">
                  <FaDollarSign />
                </span>
                <h3>Total Spent</h3>
                <p>₱{totalSpent.toLocaleString()}</p>
              </div>

              <div className="stats-card">
                <span className="stats-icon">
                  <FaChartLine />
                </span>
                <h3>Avg. Order</h3>
                <p>
                  ₱
                  {totalOrders > 0
                    ? (totalSpent / totalOrders).toFixed(2)
                    : "0.00"}
                </p>
              </div>
            </div>

            {/* My Products Section */}
            <section className="product-management">
              <div className="section-header">
                <h2>My Products</h2>
                <button
                  className="add-new-btn"
                  onClick={() => navigate("/addproduct")}
                >
                  + Add New Product
                </button>
              </div>

              {myProducts.length === 0 ? (
                <div className="empty-message">
                  You haven't added any products yet.
                </div>
              ) : (
                <div className="marketplace-grid">
                  {myProducts.map((p) => (
                    <div key={p.id} className="marketplace-card">
                      <div className="product-image">
                        <img src={p.image} alt={p.name} />
                      </div>

                      <h3>{p.name}</h3>
                      <div className="product-info">
                        <span>₱{p.price.toLocaleString()}</span>
                        <span>Stock: {p.stock}</span>
                      </div>

                      <div className="actions">
                        <button
                          className="edit-btn"
                          onClick={() => navigate(`/editproduct/${p.id}`)}
                        >
                          <FaEdit /> Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                        >
                          <FaTrash /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Profile;

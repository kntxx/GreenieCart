import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaShoppingCart,
  FaUser,
  FaBars,
  FaSearch,
  FaAngleDown,
  FaAngleUp,
  FaPlus,
  FaEdit,
  FaTrash,
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
  FaTimes,
} from "react-icons/fa";
import { IconContext } from "react-icons";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "./firebase";
import "../assets/Dashboard.css";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  createdBy: string;
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

// Popup types
interface PopupState {
  show: boolean;
  type: "success" | "error" | "info" | "confirm";
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [popup, setPopup] = useState<PopupState>({
    show: false,
    type: "info",
    message: "",
  });

  // Show popup helper
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

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleOrdersDropdown = () => setOrdersDropdownOpen(!ordersDropdownOpen);

  // Sign out handler with confirmation
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

  // Fetch products from Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const productsData: Product[] = [];
        querySnapshot.forEach((doc) => {
          productsData.push({
            id: doc.id,
            ...doc.data(),
          } as Product);
        });
        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Fetch cart count
  useEffect(() => {
    const fetchCartCount = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const cartRef = collection(db, "cart", user.uid, "items");
        const querySnapshot = await getDocs(cartRef);
        setCartCount(querySnapshot.size);
      } catch (error) {
        console.error("Error fetching cart count:", error);
      }
    };

    fetchCartCount();
  }, [addingToCart]); // Refresh when item is added

  // Check if product belongs to current user
  const isOwnProduct = (product: Product) => {
    const user = auth.currentUser;
    return user && product.createdBy === user.uid;
  };

  // Add to cart function
  const handleAddToCart = async (product: Product) => {
    const user = auth.currentUser;
    if (!user) {
      showPopup("error", "Please log in to add items to cart.");
      setTimeout(() => navigate("/login"), 1500);
      return;
    }

    // Prevent buying own product
    if (product.createdBy === user.uid) {
      showPopup("error", "You cannot buy your own product.");
      return;
    }

    if (product.stock <= 0) {
      showPopup("error", "This product is out of stock.");
      return;
    }

    setAddingToCart(product.id);

    try {
      // Check if item already exists in cart
      const cartRef = collection(db, "cart", user.uid, "items");
      const q = query(cartRef, where("productId", "==", product.id));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        showPopup("info", "This item is already in your cart!");
        setAddingToCart(null);
        return;
      }

      // Add new item to cart
      const cartItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
      };

      await addDoc(cartRef, cartItem);
      showPopup("success", `${product.name} added to cart!`);
    } catch (error) {
      console.error("Error adding to cart:", error);
      showPopup("error", "Failed to add item to cart.");
    } finally {
      setAddingToCart(null);
    }
  };

  // Delete product function
  const handleDeleteProduct = async (
    productId: string,
    productName: string
  ) => {
    const user = auth.currentUser;
    if (!user) return;

    showPopup(
      "confirm",
      `Are you sure you want to delete "${productName}"?`,
      async () => {
        try {
          await deleteDoc(doc(db, "products", productId));
          setProducts(products.filter((p) => p.id !== productId));
          showPopup("success", "Product deleted successfully!");
        } catch (error) {
          console.error("Error deleting product:", error);
          showPopup("error", "Failed to delete product.");
        }
      }
    );
  };

  // Filter products based on search term
  const filteredProducts = products.filter(
    (p) => p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Separate user's products from other products
  const myProducts = filteredProducts.filter((p) => isOwnProduct(p));
  const otherProducts = filteredProducts.filter((p) => !isOwnProduct(p));

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
        {/*<img src="/logo.png"  alt="GreenieCart Logo" className="sidebar-logo" /> */}

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

      {/* Main Content */}
      <main className={`main ${sidebarOpen ? "sidebar-open" : ""}`}>
        <IconContext.Provider value={{ style: { marginRight: "8px" } }}>
          <header className="top-navbar">
            <span className="menu-icon" onClick={toggleSidebar}>
              {" "}
              <FaBars />
            </span>
            <h2>
              WELCOME TO GREENIECART {" "}
             {/*<span style={{ color: "#FFA500" }}>JAMAIAH SHANE CABIGAS</span> */}
            </h2>
            <div className="search-notifications">
              <button
                className="add-product-btn"
                onClick={() => navigate("/addproduct")}
              >
                <FaPlus /> Add Product
              </button>
              <button className="cart-btn" onClick={() => navigate("/cart")}>
                <FaShoppingCart /> Cart
                {cartCount > 0 && (
                  <span className="cart-badge">{cartCount}</span>
                )}
              </button>
              <div className="search-bar">
                <FaSearch />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </header>

          {/* Product Sections */}
          <section className="marketplace">
            {loading ? (
              <div className="loading-message">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="empty-message">
                {searchTerm
                  ? "No products match your search."
                  : "No products available. Add your first product!"}
              </div>
            ) : (
              <>
                {/* Marketplace Section - Other Products First */}
                {otherProducts.length > 0 && (
                  <div className="product-section">
                    <h2 className="section-title">
                      <span className="section-icon">🛍️</span>
                      Marketplace
                      <span className="section-count">
                        {otherProducts.length}
                      </span>
                    </h2>
                    <div className="marketplace-grid">
                      {otherProducts.map((p) => (
                        <div key={p.id} className="marketplace-card">
                          <div className="product-image">
                            <img src={p.image} alt={p.name} />
                          </div>
                          <h3>{p.name}</h3>

                          <div className="product-info">
                            <span>₱{p.price.toLocaleString()}</span>
                            <span>Stock: {p.stock}</span>
                          </div>

                          <div className="product-actions">
                            <button
                              className="add-cart-btn"
                              onClick={() => handleAddToCart(p)}
                              disabled={addingToCart === p.id || p.stock <= 0}
                            >
                              {addingToCart === p.id ? (
                                "..."
                              ) : (
                                <>
                                  Add To
                                  <FaShoppingCart />
                                </>
                              )}
                            </button>
                            <button
                              className="buy-btn"
                              disabled={p.stock <= 0}
                              onClick={() => {
                                handleAddToCart(p).then(() =>
                                  navigate("/cart")
                                );
                              }}
                            >
                              {p.stock <= 0 ? "Out" : "Buy"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* My Products Section */}
                {myProducts.length > 0 && (
                  <div className="product-section">
                    <h2 className="section-title">
                      <span className="section-icon">🏪</span>
                      My Products
                      <span className="section-count">{myProducts.length}</span>
                    </h2>
                    <div className="marketplace-grid">
                      {myProducts.map((p) => (
                        <div
                          key={p.id}
                          className="marketplace-card my-product-card"
                        >
                          <div className="my-product-badge">Your Product</div>
                          <div className="product-image">
                            <img src={p.image} alt={p.name} />
                          </div>
                          <h3>{p.name}</h3>

                          <div className="product-info">
                            <span>₱{p.price.toLocaleString()}</span>
                            <span>Stock: {p.stock}</span>
                          </div>

                          <div className="product-actions">
                            <div className="own-product-actions">
                              <button
                                className="edit-btn"
                                onClick={() => navigate(`/editproduct/${p.id}`)}
                                title="Edit Product"
                              >
                                <FaEdit />
                                Edit
                              </button>
                              <button
                                className="delete-btn"
                                onClick={() =>
                                  handleDeleteProduct(p.id, p.name)
                                }
                                title="Delete Product"
                              >
                                <FaTrash />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty states for each section */}
                {myProducts.length === 0 && otherProducts.length === 0 && (
                  <div className="empty-message">
                    No products available yet.
                  </div>
                )}
              </>
            )}
          </section>
        </IconContext.Provider>
      </main>
    </div>
  );
};

export default Dashboard;

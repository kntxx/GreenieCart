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

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

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
      alert("Please log in to add items to cart.");
      navigate("/login");
      return;
    }

    // Prevent buying own product
    if (product.createdBy === user.uid) {
      alert("You cannot buy your own product.");
      return;
    }

    if (product.stock <= 0) {
      alert("This product is out of stock.");
      return;
    }

    setAddingToCart(product.id);

    try {
      // Check if item already exists in cart
      const cartRef = collection(db, "cart", user.uid, "items");
      const q = query(cartRef, where("productId", "==", product.id));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        alert("This item is already in your cart!");
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
      alert(`${product.name} added to cart!`);
    } catch (error) {
      console.error("Error adding to cart:", error);
      alert("Failed to add item to cart.");
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

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${productName}"?`
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "products", productId));
      setProducts(products.filter((p) => p.id !== productId));
      alert("Product deleted successfully!");
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Failed to delete product.");
    }
  };

  // Filter products based on search term
  const filteredProducts = products.filter(
    (p) => p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              WELCOME TO GREENIECART BY{" "}
              <span style={{ color: "#FFA500" }}>JAMAIAH SHANE CABIGAS</span>
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

          {/* Product grid */}
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
              <div className="marketplace-grid">
                {filteredProducts.map((p) => (
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
                      {isOwnProduct(p) ? (
                        <div className="own-product-actions">
                          <button
                            className="edit-btn"
                            onClick={() => navigate(`/editproduct/${p.id}`)}
                            title="Edit Product"
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            title="Delete Product"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            className="add-cart-btn"
                            onClick={() => handleAddToCart(p)}
                            disabled={addingToCart === p.id || p.stock <= 0}
                          >
                            {addingToCart === p.id ? "..." : <FaShoppingCart />}
                          </button>
                          <button
                            className="buy-btn"
                            disabled={p.stock <= 0}
                            onClick={() => {
                              handleAddToCart(p).then(() => navigate("/cart"));
                            }}
                          >
                            {p.stock <= 0 ? "Out" : "Buy"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </IconContext.Provider>
      </main>
    </div>
  );
};

export default Dashboard;

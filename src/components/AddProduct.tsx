import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaShoppingCart,
  FaUser,
  FaBars,
  FaAngleDown,
  FaAngleUp,
  FaPlus,
  FaCloudUploadAlt,
} from "react-icons/fa";
import { IconContext } from "react-icons";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import { db, auth, storage } from "./firebase";
import Input from "./Input";
import "../assets/AddProduct.css";

interface ProductForm {
  name: string;
  price: string;
  stock: string;
}

const AddProduct: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const [formData, setFormData] = useState<ProductForm>({
    name: "",
    price: "",
    stock: "",
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB.");
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to add a product.");
      setLoading(false);
      return;
    }

    // Validate fields
    if (!formData.name.trim() || !formData.price || !formData.stock) {
      setError("All fields are required.");
      setLoading(false);
      return;
    }

    if (!imageFile) {
      setError("Please select a product image.");
      setLoading(false);
      return;
    }

    const price = parseFloat(formData.price);
    const stock = parseInt(formData.stock, 10);

    if (isNaN(price) || price <= 0) {
      setError("Please enter a valid price.");
      setLoading(false);
      return;
    }

    if (isNaN(stock) || stock < 0) {
      setError("Please enter a valid stock quantity.");
      setLoading(false);
      return;
    }

    try {
      // Upload image to Firebase Storage
      const timestamp = Date.now();
      const fileName = `products/${user.uid}/${timestamp}_${imageFile.name}`;
      const storageRef = ref(storage, fileName);

      const snapshot = await uploadBytes(storageRef, imageFile);
      const imageUrl = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "products"), {
        name: formData.name.trim(),
        price: price,
        stock: stock,
        image: imageUrl,
        createdBy: user.uid,
        createdAt: new Date(),
      });

      // Redirect to dashboard after success
      navigate("/home");
    } catch (error) {
      console.error("Error adding product:", error);
      setError("Failed to add product. Please try again.");
    } finally {
      setLoading(false);
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
            <h2>ADD NEW PRODUCT</h2>
          </header>

          {/* Add Product Form */}
          <div className="add-product-container">
            <div className="add-product-card">
              <div className="add-product-header">
                <FaPlus className="add-icon" />
                <h3>Add New Product</h3>
              </div>

              {error && <div className="error-message">{error}</div>}

              <form onSubmit={handleSubmit} className="add-product-form">
                <Input
                  label="Product Name"
                  type="text"
                  name="name"
                  placeholder="Enter product name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />

                <div className="form-row">
                  <Input
                    label="Price (₱)"
                    type="number"
                    name="price"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required
                  />

                  <Input
                    label="Stock Quantity"
                    type="number"
                    name="stock"
                    placeholder="0"
                    value={formData.stock}
                    onChange={handleChange}
                    min="0"
                    required
                  />
                </div>

                {/* Image Upload */}
                <div className="image-upload-group">
                  <label>Product Image</label>
                  <div
                    className="image-upload-area"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="upload-preview"
                      />
                    ) : (
                      <div className="upload-placeholder">
                        <FaCloudUploadAlt className="upload-icon" />
                        <p>Click to upload image</p>
                        <span>PNG, JPG, JPEG (max 5MB)</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                  />
                  {imageFile && (
                    <p className="file-name">Selected: {imageFile.name}</p>
                  )}
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => navigate("/home")}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={loading}
                  >
                    {loading ? "Uploading..." : "Add Product"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </IconContext.Provider>
      </main>
    </div>
  );
};

export default AddProduct;

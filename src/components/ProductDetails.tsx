import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaChevronLeft,
  FaShoppingCart,
  FaCheckCircle,
  FaExclamationCircle,
  FaTimes,
} from "react-icons/fa";
import { doc, getDoc, collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { db, auth } from "./firebase";
import "../assets/ProductDetails.css";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  createdBy: string;
  createdAt?: { seconds: number; nanoseconds: number } | Date;
  description?: string;
  category?: string;
}

interface SellerInfo {
  name: string;
  email: string;
}

interface PopupState {
  show: boolean;
  type: "success" | "error" | "info";
  message: string;
}

const ProductDetails: React.FC = () => {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [popup, setPopup] = useState<PopupState>({
    show: false,
    type: "info",
    message: "",
  });

  const showPopup = (type: PopupState["type"], message: string) => {
    setPopup({ show: true, type, message });
  };

  const closePopup = () => {
    setPopup({ ...popup, show: false });
  };

  // Fetch product details
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) {
        setLoading(false);
        return;
      }

      try {
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const productData = {
            id: productSnap.id,
            ...productSnap.data(),
          } as Product;
          setProduct(productData);

          // Try to fetch seller info
          if (productData.createdBy) {
            try {
              const usersQuery = query(
                collection(db, "users"),
                where("uid", "==", productData.createdBy)
              );
              const usersSnap = await getDocs(usersQuery);
              if (!usersSnap.empty) {
                const userData = usersSnap.docs[0].data();
                setSeller({
                  name: userData.name || userData.displayName || "Seller",
                  email: userData.email || "",
                });
              }
            } catch {
              console.log("Could not fetch seller info");
            }
          }
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Format date
  const formatDate = (dateValue: { seconds: number; nanoseconds: number } | Date | undefined) => {
    if (!dateValue) return "Unknown";
    
    let date: Date;
    if ('seconds' in dateValue) {
      date = new Date(dateValue.seconds * 1000);
    } else {
      date = dateValue;
    }
    
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Check if product belongs to current user
  const isOwnProduct = () => {
    const user = auth.currentUser;
    return user && product && product.createdBy === user.uid;
  };

  // Add to cart
  const handleAddToCart = async () => {
    const user = auth.currentUser;
    if (!user) {
      showPopup("error", "Please log in to add items to cart.");
      setTimeout(() => navigate("/login"), 1500);
      return;
    }

    if (!product) return;

    if (isOwnProduct()) {
      showPopup("error", "You cannot buy your own product.");
      return;
    }

    if (product.stock <= 0) {
      showPopup("error", "This product is out of stock.");
      return;
    }

    setAddingToCart(true);

    try {
      const cartRef = collection(db, "cart", user.uid, "items");
      const q = query(cartRef, where("productId", "==", product.id));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        showPopup("info", "This item is already in your cart!");
        setAddingToCart(false);
        return;
      }

      await addDoc(cartRef, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
      });

      showPopup("success", `${product.name} added to cart!`);
    } catch (error) {
      console.error("Error adding to cart:", error);
      showPopup("error", "Failed to add item to cart.");
    } finally {
      setAddingToCart(false);
    }
  };

  // Buy now
  const handleBuyNow = async () => {
    await handleAddToCart();
    if (popup.type === "success") {
      setTimeout(() => navigate("/cart"), 500);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="product-details-page">
        <div className="product-details-container">
          {/* Back button skeleton */}
          <div className="back-button skeleton-btn">
            <div className="skeleton-text" style={{ width: "80px" }}></div>
          </div>

          {/* Image skeleton */}
          <div className="product-image-card skeleton-image"></div>

          {/* Content skeleton */}
          <div className="product-content">
            <div className="skeleton-text" style={{ width: "60%", height: "32px" }}></div>
            <div className="skeleton-text" style={{ width: "100px", height: "24px", marginTop: "8px" }}></div>
            <div className="skeleton-text" style={{ width: "120px", height: "36px", marginTop: "16px" }}></div>
            <div className="skeleton-text" style={{ width: "100%", height: "100px", marginTop: "24px" }}></div>
          </div>

          {/* Actions skeleton */}
          <div className="product-actions-bar">
            <div className="skeleton-btn" style={{ flex: 1, height: "56px" }}></div>
            <div className="skeleton-btn" style={{ flex: 1, height: "56px" }}></div>
          </div>
        </div>
      </div>
    );
  }

  // Product not found
  if (!product) {
    return (
      <div className="product-details-page">
        <div className="product-details-container">
          <button className="back-button" onClick={() => navigate(-1)}>
            <FaChevronLeft />
            <span>Back</span>
          </button>
          <div className="not-found">
            <h2>Product Not Found</h2>
            <p>The product you're looking for doesn't exist or has been removed.</p>
            <button className="back-home-btn" onClick={() => navigate("/home")}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="product-details-page">
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
              {popup.type === "info" && <FaExclamationCircle />}
            </div>
            <p className="popup-message">{popup.message}</p>
            <button className="popup-btn popup-btn-ok" onClick={closePopup}>
              OK
            </button>
          </div>
        </div>
      )}

      <div className="product-details-container">
        {/* iOS Back Button */}
        <button className="back-button" onClick={() => navigate(-1)}>
          <FaChevronLeft />
          <span>Back</span>
        </button>

        {/* Product Image Card */}
        <div className="product-image-card">
          <img src={product.image} alt={product.name} />
        </div>

        {/* Product Content */}
        <div className="product-content">
          {/* Category Badge */}
          {product.category && (
            <span className="product-category-badge">{product.category}</span>
          )}

          {/* Product Name */}
          <h1 className="product-title">{product.name}</h1>

          {/* Price */}
          <p className="product-price">₱{product.price.toLocaleString()}</p>

          {/* Stock Status */}
          <div className="product-stock">
            <span className={`stock-badge ${product.stock > 0 ? "in-stock" : "out-of-stock"}`}>
              {product.stock > 0 ? `${product.stock} in stock` : "Out of Stock"}
            </span>
          </div>

          {/* Description */}
          <div className="product-description-section">
            <h3>Description</h3>
            <p>
              {product.description ||
                "No description available for this product. Contact the seller for more information."}
            </p>
          </div>

          {/* Product Meta */}
          <div className="product-meta">
            <div className="meta-item">
              <span className="meta-label">Listed on</span>
              <span className="meta-value">{formatDate(product.createdAt)}</span>
            </div>
            {seller && (
              <div className="meta-item">
                <span className="meta-label">Seller</span>
                <span className="meta-value">{seller.name}</span>
              </div>
            )}
          </div>

          {/* Own Product Notice */}
          {isOwnProduct() && (
            <div className="own-product-notice">
              <span>This is your product</span>
            </div>
          )}
        </div>

        {/* Action Buttons - Fixed at bottom on mobile */}
        {!isOwnProduct() && (
          <div className="product-actions-bar">
            <button
              className="action-btn add-to-cart-btn"
              onClick={handleAddToCart}
              disabled={addingToCart || product.stock <= 0}
            >
              <FaShoppingCart />
              {addingToCart ? "Adding..." : "Add to Cart"}
            </button>
            <button
              className="action-btn buy-now-btn"
              onClick={handleBuyNow}
              disabled={addingToCart || product.stock <= 0}
            >
              Buy Now
            </button>
          </div>
        )}

        {/* Edit button for own products */}
        {isOwnProduct() && (
          <div className="product-actions-bar">
            <button
              className="action-btn edit-product-btn"
              onClick={() => navigate(`/editproduct/${product.id}`)}
            >
              Edit Product
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetails;

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
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
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
import CountUp from "./CountUp";
import axios from "axios";
import "../assets/Profile.css";
import { IconContext } from "react-icons";





interface Province { name: string; code: string; }
interface City { name: string; code: string; provinceCode: string; }
interface Barangay { name: string; code: string; }


interface AddressData {
  houseNo?: string;
  street?: string;
  barangay?: string;
  barangayCode?: string;
  city?: string;
  cityCode?: string;
  province?: string;
  provinceCode?: string;
  zipCode?: string;
}

interface UserData {
  firstName: string;
  lastName: string;
  contact: string;
  email: string;
  userId: string;
  address: AddressData;
  photoURL?: string | null;
}

interface Product { id: string; name: string; price: number; stock: number; image: string; createdBy: string; }
interface Order { id: string; items: any[]; total: number; createdAt: Date; }

interface PopupState {
  show: boolean;
  type: "success" | "error" | "info" | "confirm";
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ordersDropdownOpen, setOrdersDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState<PopupState>({ show: false, type: "info", message: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);


  const [userData, setUserData] = useState<UserData>({
    firstName: "", lastName: "", contact: "", email: "", userId: "",
    address: { houseNo: "", street: "", barangay: "", city: "", province: "", zipCode: "" }
  });
  const [editData, setEditData] = useState<UserData>(userData);

 
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [, setLoadingLocations] = useState(false);

  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleOrdersDropdown = () => setOrdersDropdownOpen(!ordersDropdownOpen);

  const showPopup = (type: PopupState["type"], message: string, onConfirm?: () => void, confirmText?: string) => {
    setPopup({ show: true, type, message, onConfirm, confirmText });
  };
  const closePopup = () => setPopup({ ...popup, show: false });
  const closeSidebar = () => setSidebarOpen(false);


  const fetchWithCache = async (key: string, url: string) => {
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);
    const res = await axios.get(url);
    localStorage.setItem(key, JSON.stringify(res.data));
    return res.data;
  };

 
  useEffect(() => {
    const loadLocations = async () => {
      setLoadingLocations(true);
      try {
        const provs = await fetchWithCache("ph_provinces", "https://psgc.gitlab.io/api/provinces.json");
        setProvinces(provs.map((p: any) => ({ name: p.name, code: p.code })).sort((a: any, b: any) => a.name.localeCompare(b.name)));

        const allCities = await fetchWithCache("ph_cities", "https://psgc.gitlab.io/api/cities-municipalities.json");
        setCities(allCities.map((c: any) => ({
          name: c.name,
          code: c.code,
          provinceCode: c.provinceCode
        })));
      } catch (err) {
        console.error("Failed to load locations", err);
      } finally {
        setLoadingLocations(false);
      }
    };
    loadLocations();
  }, []);

 
  const loadBarangays = async (cityCode: string) => {
    const key = `barangays_${cityCode}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      setBarangays(JSON.parse(cached));
      return;
    }
    try {
      const res = await axios.get(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays.json`);
      const list = res.data.map((b: any) => ({ name: b.name, code: b.code })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      localStorage.setItem(key, JSON.stringify(list));
      setBarangays(list);
    } catch {
      setBarangays([]);
    }
  };


useEffect(() => {
  const fetchData = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();

        
        const photoURL = data.photoURL || user.photoURL || null;

        const userInfo: UserData & { photoURL?: string | null } = {
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          contact: data.contact || "",
          email: data.email || user.email || "",
          userId: data.userId || "",
          photoURL: photoURL, 
          address: {
            houseNo: data.address?.houseNo || "",
            street: data.address?.street || "",
            barangay: data.address?.barangay || "",
            barangayCode: data.address?.barangayCode || "",
            city: data.address?.city || "",
            cityCode: data.address?.cityCode || "",
            province: data.address?.province || "",
            provinceCode: data.address?.provinceCode || "",
            zipCode: data.address?.zipCode || "",
          },
        };

      
        setUserData(userInfo);
        setEditData(userInfo);
        setPhotoPreview(photoURL); 
      }

   
      const prodQuery = query(collection(db, "products"), where("createdBy", "==", user.uid));
      const prodSnap = await getDocs(prodQuery);
      setMyProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);

      const ordersRef = collection(db, "orders", user.uid, "items");
      const orderSnap = await getDocs(ordersRef);
      setMyOrders(orderSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Order[]);

    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);

  
  const fetchZipCode = async (cityCode: string) => {
  if (!cityCode) return;

  try {
   
    const res = await axios.get(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}.json`);
    const zip = res.data.zip_code || res.data.zipCode || "";
    if (zip) {
      setEditData(prev => ({
        ...prev,
        address: { ...prev.address, zipCode: zip }
      }));
      return;
    }
  } catch (err) {
    
  }

 
  try {
    const allCities = await fetchWithCache("ph_cities", "https://psgc.gitlab.io/api/cities-municipalities.json");
    const cityData = allCities.find((c: any) => c.code === cityCode);
    const zip = cityData?.zip_code || cityData?.zipCode || "";

    setEditData(prev => ({
      ...prev,
      address: { ...prev.address, zipCode: zip || "N/A" }
    }));
  } catch (err) {
    setEditData(prev => ({
      ...prev,
      address: { ...prev.address, zipCode: "N/A" }
    }));
  }
};

useEffect(() => {
  if (isEditing && editData.address.cityCode && !editData.address.zipCode) {
    loadBarangays(editData.address.cityCode);
    fetchZipCode(editData.address.cityCode); 
  }
}, [isEditing, editData.address.cityCode]);
 

  useEffect(() => {
    if (isEditing && editData.address.cityCode) {
      loadBarangays(editData.address.cityCode);
      if (!editData.address.zipCode) {
        axios.get(`https://psgc.gitlab.io/api/cities-municipalities/${editData.address.cityCode}.json`)
          .then(res => {
            setEditData(prev => ({
              ...prev,
              address: { ...prev.address, zipCode: res.data.zipCode || "" }
            }));
          }).catch(() => {});
      }
    }
  }, [isEditing, editData.address.cityCode]);

  
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value } = e.target;

  if (name === "province") {
    const prov = provinces.find(p => p.name === value);
    setEditData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        province: value,
        provinceCode: prov?.code || "",
        city: "", 
        cityCode: "", 
        barangay: "", 
        barangayCode: "", 
        zipCode: ""  
      }
    }));
    setBarangays([]); 
  }

  else if (name === "city") {
    const city = cities.find(c => c.name === value);

    setEditData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        city: value,
        cityCode: city?.code || "",
        barangay: "",
        barangayCode: "",
        zipCode: prev.address.zipCode 
      }
    }));

    if (city?.code) {
      loadBarangays(city.code);

    
      fetchZipCode(city.code);
    } else {
      setBarangays([]);
    }
  }

  else if (name === "barangay") {
    const brgy = barangays.find(b => b.name === value);
    setEditData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        barangay: value,
        barangayCode: brgy?.code || ""
      }
    }));
  }

  else {
  
    setEditData(prev => ({
      ...prev,
      address: { ...prev.address, [name]: value }
    }));
  }
};

  const filteredCities = cities.filter(c => c.provinceCode === editData.address.provinceCode);

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

  
const handleSaveProfile = async () => {
  if (!editData.firstName.trim() || !editData.lastName.trim()) {
    showPopup("error", "First and last name are required.");
    return;
  }
  if (editData.contact && !/^09\d{9}$/.test(editData.contact)) {
    showPopup("error", "Contact must be 11 digits starting with 09");
    return;
  }

  setSaving(true);
  try {
    let finalPhotoBase64: string | null = userData.photoURL || null;

   
    if (photoFile) {
      setUploadingPhoto(true);
      finalPhotoBase64 = await fileToBase64(photoFile);
      setUploadingPhoto(false);
    }

    await updateDoc(doc(db, "users", auth.currentUser!.uid), {
      firstName: editData.firstName.trim(),
      lastName: editData.lastName.trim(),
      contact: editData.contact,
      address: editData.address,
      photoURL: finalPhotoBase64, 
      updatedAt: new Date(),
    });


    await updateProfile(auth.currentUser!, {
      displayName: `${editData.firstName} ${editData.lastName}`.trim(),
    });

 
    const updatedUserData = { ...editData, photoURL: finalPhotoBase64 };
    setUserData(updatedUserData);
    setEditData(updatedUserData);
    setPhotoPreview(finalPhotoBase64);
    setPhotoFile(null);

    setIsEditing(false);
    showPopup("success", "Profile updated successfully!");
  } catch (err: any) {
    console.error("Save error:", err);
    showPopup("error", err.message || "Failed to save profile.");
  } finally {
    setSaving(false);
    setUploadingPhoto(false);
  }
};

 
  const getFullAddress = () => {
    const a = userData.address;
    const parts = [
      a.houseNo && `House ${a.houseNo}`,
      a.street,
      a.barangay && `Brgy. ${a.barangay}`,
      a.city,
      a.province,
      a.zipCode && a.zipCode
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : "No address set";
  };

  const totalProducts = myProducts.length;
  const totalOrders = myOrders.length;
  const totalSpent = myOrders.reduce((a, o) => a + (o.total || 0), 0);

  const handleDeleteProduct = async (productId: string, productName: string) => {
    showPopup("confirm", `Delete "${productName}"?`, async () => {
      await deleteDoc(doc(db, "products", productId));
      setMyProducts(prev => prev.filter(p => p.id !== productId));
      showPopup("success", "Product deleted!");
    });
  };

  const handleSignOut = () => {
    showPopup("confirm", "Sign out?", async () => {
      await signOut(auth);
      navigate("/login");
    });
  };

  return (
    <div className="dashboard">
     
      {popup.show && (
        <div className="popup-overlay" onClick={closePopup}>
          <div className="popup-modal" onClick={e => e.stopPropagation()}>
            <button className="popup-close" onClick={closePopup}><FaTimes /></button>
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
                  <button className="popup-btn popup-btn-cancel" onClick={closePopup}>Cancel</button>
                  <button className="popup-btn popup-btn-confirm" onClick={() => { popup.onConfirm?.(); closePopup(); }}>
                    {popup.confirmText || "Confirm"}
                  </button>
                </>
              ) : (
                <button className="popup-btn popup-btn-ok" onClick={closePopup}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}

       <div
        className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={closeSidebar}
      ></div>

     
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
        <header className="top-navbar">
          <span className="menu-icon" onClick={toggleSidebar}><FaBars /></span>
          <h2>MY PROFILE</h2>
        </header>

        {loading ? <div className="loading-message">Loading...</div> : (
          <>
            <section className="profile-container">
              <div className="profile-header-row">
                <div className="profile-user-block">
  <img
    className="profile-avatar"
    src={
      userData.photoURL || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        `${userData.firstName} ${userData.lastName}`
      )}&background=166534&color=fff&size=120&bold=true`
    }
    alt="Profile"
    onError={(e) => {
     
      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        userData.firstName?.[0] || "U"
      )}&background=166534&color=fff&size=120`;
    }}
  />
  <div className="profile-user-text">
    <h3>{userData.firstName} {userData.lastName}</h3>
    <p className="email">{userData.email}</p>
    {userData.userId && <p className="user-id">ID: {userData.userId}</p>}
  </div>

                </div>
                {!isEditing ? (
                  <button className="edit-profile-btn" onClick={() => setIsEditing(true)}>
                    <FaEdit /> Edit Profile
                  </button>
                ) : (
                  <div className="edit-actions">
                    <button className="save-btn" onClick={handleSaveProfile} disabled={saving}>
                      <FaSave /> {saving ? "Saving..." : "Save"}
                    </button>
                    <button className="cancel-btn" onClick={() => { setEditData(userData); setIsEditing(false); }}>
                      <FaTimes /> Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="profile-details">
                {isEditing ? (

                  
                  <div className="profile-edit-form">

                    <div className="profile-photo-section">
      <div className="current-photo">
       <img
  src={
    photoPreview ||                     
    userData.photoURL ||               
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${editData.firstName || "User"} ${editData.lastName || ""}`.trim()
    )}&background=166534&color=fff&size=150&bold=true`
  }
  alt="Profile picture"
  className="edit-photo-preview"
  onError={(e) => {
    e.currentTarget.src = `https://ui-avatars.com/api/?name=U&background=166534&color=fff&size=150`;
  }}
/>
        {uploadingPhoto && (
          <div className="uploading-overlay">
            <p className="uploading-text">Uploading photo...</p>
          </div>
        )}
      </div>

      <div className="photo-upload-controls">
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

           
            if (file.size > 5 * 1024 * 1024) {
              showPopup("error", "Photo must be under 5MB");
              return;
            }

            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
          }}
          id="photo-upload-input"
          style={{ display: "none" }}
        />
        <label
          htmlFor="photo-upload-input"
          className="upload-btn"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              document.getElementById("photo-upload-input")?.click();
            }
          }}
        >
          Change Photo
        </label>

        {photoFile && (
          <button
            type="button"
            onClick={() => {
              if (photoPreview?.startsWith("blob:")) {
                URL.revokeObjectURL(photoPreview);
              }
              setPhotoFile(null);
              setPhotoPreview(userData.photoURL || null);
            }}
            className="remove-photo-btn"
          >
            Remove
          </button>
        )}
      </div>
    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>First Name</label>
                        <input name="firstName" value={editData.firstName} onChange={e => setEditData(p => ({ ...p, firstName: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Last Name</label>
                        <input name="lastName" value={editData.lastName} onChange={e => setEditData(p => ({ ...p, lastName: e.target.value }))} />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Contact Number</label>
                        <input
                          name="contact"
                          value={editData.contact}
                          onChange={e => {
                            if (/^\d*$/.test(e.target.value) && e.target.value.length <= 11)
                              setEditData(p => ({ ...p, contact: e.target.value }));
                          }}
                          placeholder="09XXXXXXXXX"
                        />
                      </div>
                    </div>

                    <div className="address-section">
                      <h4>Address Details</h4>

                      <div className="form-row">
                        <div className="form-group">
                          <label>House No.</label>
                          <input name="houseNo" value={editData.address.houseNo || ""} onChange={handleAddressChange} />
                        </div>
                        <div className="form-group">
                          <label>Street</label>
                          <input name="street" value={editData.address.street || ""} onChange={handleAddressChange} />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Province</label>
                          <select name="province" value={editData.address.province || ""} onChange={handleAddressChange}>
                            <option value="">Select Province</option>
                            {provinces.map(p => <option key={p.code} value={p.name}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>City/Municipality</label>
                          <select name="city" value={editData.address.city || ""} onChange={handleAddressChange} disabled={!editData.address.province}>
                            <option value="">Select City</option>
                            {filteredCities.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Barangay</label>
                          <select name="barangay" value={editData.address.barangay || ""} onChange={handleAddressChange} disabled={!editData.address.city}>
                            <option value="">Select Barangay</option>
                            {barangays.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>ZIP Code</label>
                          <input
                              name="zipCode"
                              value={editData.address.zipCode || ""}
                              onChange={handleAddressChange}
                              placeholder="Enter ZIP code (optional)"
                               maxLength={4}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="profile-display-grid">
                    <div className="display-row"><label>First Name</label><p>{userData.firstName || "—"}</p></div>
                    <div className="display-row"><label>Last Name</label><p>{userData.lastName || "—"}</p></div>
                    <div className="display-row"><label>Contact</label><p>{userData.contact || "—"}</p></div>
                    <div className="display-row"><label>Email</label><p>{userData.email}</p></div>
                    <div className="display-row address-row">
                      <label>Address</label>
                      <p className="address-display">{getFullAddress()}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

             {/* Stats Cards */}
            <div className="profile-stats">
              <div className="stats-card products-card">
                <div className="stats-icon-wrapper">
                  <FaBoxOpen />
                </div>
                <div className="stats-content">
                  <h3>My Products</h3>
                  <p>
                    <CountUp
                      to={totalProducts}
                      from={0}
                      duration={2}
                      separator=","
                      className="count-value"
                    />
                  </p>
                </div>
              </div>
              <div className="stats-card orders-card">
                <div className="stats-icon-wrapper">
                  <FaShoppingCart />
                </div>
                <div className="stats-content">
                  <h3>My Orders</h3>
                  <p>
                    <CountUp
                      to={totalOrders}
                      from={0}
                      duration={2}
                      separator=","
                      className="count-value"
                    />
                  </p>
                </div>
              </div>
              <div className="stats-card spent-card">
                <div className="stats-icon-wrapper">
                  <FaDollarSign />
                </div>
                <div className="stats-content">
                  <h3>Total Spent</h3>
                  <p>
                    ₱
                    <CountUp
                      to={totalSpent}
                      from={0}
                      duration={2.5}
                      separator=","
                      className="count-value"
                    />
                  </p>
                </div>
              </div>
              <div className="stats-card avg-card">
                <div className="stats-icon-wrapper">
                  <FaChartLine />
                </div>
                <div className="stats-content">
                  <h3>Avg. Order</h3>
                  <p>
                    ₱
                    <CountUp
                      to={
                        totalOrders > 0
                          ? Math.round((totalSpent / totalOrders) * 100) / 100
                          : 0
                      }
                      from={0}
                      duration={2.5}
                      separator=","
                      className="count-value"
                    />
                  </p>
                </div>
              </div>
            </div>

            <section className="product-management">
              <div className="section-header">
                <h2>My Products</h2>
                <button className="add-new-btn" onClick={() => navigate("/addproduct")}>+ Add New Product</button>
              </div>
              {myProducts.length === 0 ? (
                <div className="empty-message">You haven't added any products yet.</div>
              ) : (
                <div className="marketplace-grid">
                  {myProducts.map(p => (
                    <div key={p.id} className="marketplace-card">
                      <div className="product-image"><img src={p.image} alt={p.name} /></div>
                      <h3>{p.name}</h3>
                      <div className="product-info">
                        <span>₱{p.price.toLocaleString()}</span>
                        <span>Stock: {p.stock}</span>
                      </div>
                      <div className="actions">
                        <button className="edit-btn" onClick={() => navigate(`/editproduct/${p.id}`)}><FaEdit /> Edit</button>
                        <button className="delete-btn" onClick={() => handleDeleteProduct(p.id, p.name)}><FaTrash /> Delete</button>
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
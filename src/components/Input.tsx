import React from "react";
import "../assets/Input.css";


interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const Input: React.FC<InputProps> = ({ label, ...props }) => {
  return (
    <div className="input-group">
      <label>{label}</label>
      <input {...props} />
    </div>
  );
};

export default Input;

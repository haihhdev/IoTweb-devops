import React from "react";
import { FaFacebookF, FaGoogle, FaLinkedinIn } from "react-icons/fa";
import "./login.css";
import { auth, provider } from "../utils/firebase";
import { signInWithPopup } from "firebase/auth";
import { useHistory } from "react-router-dom";

const LoginPage = () => {
  const history = useHistory();

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      history.push("/");
    } catch (error) {
      alert("Google login failed: " + error.message);
    }
  };

  return (
    <div className="login-root w-full">
      <div className="login-container">
        {/* Left Side */}
        <div className="login-left">
          <div className="login-logo">IOT Smart Home</div>
          <h2>Welcome Back!</h2>
          <p>
            If you don't have an account
            <br />
            please sign up
          </p>
          <button className="login-signin-btn">SIGN UP</button>
        </div>
        {/* Right Side */}
        <div className="login-right">
          <h2>Sign In</h2>
          <div className="login-socials">
            <button>
              <FaFacebookF />
            </button>
            <button onClick={handleGoogleLogin} type="button">
              <FaGoogle />
            </button>
            <button>
              <FaLinkedinIn />
            </button>
          </div>
          <span className="login-or">or use your email for login:</span>
          <form className="login-form">
            <div className="login-input-group">
              <span className="login-input-icon">
                <i className="fa fa-user"></i>
              </span>
              <input type="text" placeholder="Name" />
            </div>

            <div className="login-input-group">
              <span className="login-input-icon">
                <i className="fa fa-lock"></i>
              </span>
              <input type="password" placeholder="Password" />
            </div>
            <button className="login-signup-btn" type="submit">
              SIGN IN
            </button>
          </form>
        </div>
      </div>
      {/* Background shapes */}
      <div className="login-bg-shape login-bg-yellow"></div>
      <div className="login-bg-shape login-bg-red"></div>
    </div>
  );
};

export default LoginPage;

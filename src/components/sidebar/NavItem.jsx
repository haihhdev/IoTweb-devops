import React from "react";

const NavItem = (props) => {
  const { icon, text, link } = props;

  return (
    <li className="nav-item">
      <a className="nav-link" href={link} style={{ color: "#666" }}>
        <i className={`fas fa-fw ${icon}`}></i>
        <span>{text}</span>
      </a>
    </li>
  );
};

export default NavItem;

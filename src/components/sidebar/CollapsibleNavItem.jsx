import React from "react";
import { useHistory } from "react-router-dom";
import { auth } from "../../utils/firebase";

const SubItems = (props) => {
  const history = useHistory();
  const items = new Map(props.items);
  const subItems = [];

  items.forEach((link, item) => {
    if (item === "Logout") {
      subItems.push(
        <a
          className="collapse-item"
          href="#"
          key="logout"
          onClick={async (e) => {
            e.preventDefault();
            await auth.signOut();
            history.push("/login");
          }}
        >
          {item}
        </a>
      );
    } else {
      subItems.push(
        <a className="collapse-item" href={link} key={link}>
          {item}
        </a>
      );
    }
  });
  return <>{subItems}</>;
};

const CollapsibleNavItem = (props) => {
  const { id, icon, text, subtext, items } = props;
  return (
    <li className="nav-item">
      <a
        className="nav-link collapsed"
        href="#"
        data-toggle="collapse"
        data-target={`#${id}`}
        aria-expanded="true"
        aria-controls={id}
        style={{ color: "#666" }}
      >
        <i className={`fas fa-fw ${icon}`}></i>
        <span>{text}</span>
      </a>
      <div
        id={id}
        className="collapse"
        aria-labelledby="headingTwo"
        data-parent="#accordionSidebar"
      >
        <div className="bg-white py-2 collapse-inner rounded">
          <h6 className="collapse-header" style={{ color: "#666" }}>
            {subtext}
          </h6>
          <SubItems items={items} />
        </div>
      </div>
    </li>
  );
};

export default CollapsibleNavItem;

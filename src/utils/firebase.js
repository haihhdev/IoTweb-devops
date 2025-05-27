// Firebase config và khởi tạo app
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAqDqxSOsnq1x4Y5id_I-FqbxLqrGKFZ9M",
  authDomain: "iot-frontend-web.firebaseapp.com",
  projectId: "iot-frontend-web",
  storageBucket: "iot-frontend-web.firebasestorage.app",
  messagingSenderId: "88814140369",
  appId: "1:88814140369:web:178b0cf7cd1693ea1efef0",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };

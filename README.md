# IoT Dashboard for Smart Building with AI & DevOps

Một hệ thống dashboard thông minh để giám sát và điều khiển các thiết bị IoT trong tòa nhà, tích hợp AI, nhận diện khuôn mặt, chatbot thông minh và triển khai DevOps hiện đại.

## 🌟 Tính năng chính

- **Dashboard IoT**: Hiển thị trực quan trạng thái các cảm biến, thiết bị thông minh
- **Nhận diện khuôn mặt**: Xác thực người dùng bằng AI (DeepFace)
- **Chatbot AI**: Hỗ trợ giao tiếp tự nhiên, trả lời câu hỏi, thực hiện lệnh
- **Rule Engine**: Tạo luật tự động hóa cho thiết bị (json-rules-engine)
- **Điều khiển thiết bị**: Bật/tắt đèn, quạt, mở/đóng cửa qua MQTT
- **Đa ngôn ngữ**: Hỗ trợ tiếng Anh, Đức (i18n)
- **DevOps**: Triển khai tự động trên AWS EKS với ArgoCD GitOps
- **Monitoring**: Thông báo qua Telegram, healthcheck, logging

## 🏗️ Kiến trúc hệ thống

### Frontend (React SPA)

- **React 18** với Redux cho quản lý trạng thái
- **React Router** cho navigation
- **Bootstrap** cho UI/UX
- **Canvas API** cho hiển thị sensor với animation
- **json-rules-engine** cho rule automation
- **react-i18next** cho đa ngôn ngữ

### Backend (Python Flask)

- **Flask** REST API server
- **DeepFace** cho nhận diện khuôn mặt
- **TensorFlow/Keras** cho AI/ML
- **MQTT** cho giao tiếp với thiết bị IoT
- **Firebase** cho real-time database
- **Telegram API** cho thông báo
- **OpenCV/MediaPipe** cho xử lý ảnh

### DevOps & Infrastructure

- **Terraform** cho Infrastructure as Code (AWS)
- **Docker** cho containerization
- **Kubernetes (EKS)** cho orchestration
- **ArgoCD** cho GitOps CI/CD
- **AWS** (EKS, S3, DynamoDB, LoadBalancer)

## 🚀 Cài đặt và chạy

### Yêu cầu hệ thống

- Node.js 18+
- Python 3.10+
- Docker & Docker Compose
- AWS CLI (cho deployment)

### Development

```bash
# Clone repository
git clone https://github.com/your-username/IoTweb-devops.git
cd IoTweb-devops

# Frontend
npm install
npm start

# Backend
cd BE
pip install -r requirements.txt
python final_server.py
```

### Production Deployment

```bash
# Build Docker images
docker build -t iot-frontend .
docker build -t iot-backend ./BE

# Deploy với Terraform
cd infrastructure
terraform init
terraform plan
terraform apply

# Deploy với ArgoCD (GitOps)
kubectl apply -f k8s/argo-application.yaml
```

**Made with ❤️ for Smart Building IoT Management**

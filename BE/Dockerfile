FROM python:3.10-slim

# Cài các gói hệ thống cần thiết trong 1 layer duy nhất (giảm dung lượng image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgl1-mesa-glx \
    libopencv-dev \
    ffmpeg \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Chỉ copy requirements trước để tận dụng cache khi install pip
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code sau (để nếu code đổi thì chỉ phải pip install lại nếu thay đổi requirements)
COPY . .

# Nếu bạn có biến môi trường, expose port, ... thì thêm ở đây
EXPOSE 5000

CMD ["python", "final_server.py"]

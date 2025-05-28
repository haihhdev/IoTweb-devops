from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import time

BASE_URL = "http://localhost:3000"

def check_login_page(driver):
    print("🟦 Kiểm tra trang /login...")
    driver.get(f"{BASE_URL}/login")
    time.sleep(1)
    # SIGN IN button
    sign_in_btns = driver.find_elements(By.XPATH, "//button[contains(translate(text(),'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'SIGN IN')]")
    assert sign_in_btns, "❌ Không tìm thấy nút SIGN IN"
    # SIGN UP button
    sign_up_btns = driver.find_elements(By.XPATH, "//button[contains(translate(text(),'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'SIGN UP')]")
    assert sign_up_btns, "❌ Không tìm thấy nút SIGN UP"
    # Input Name
    name_inputs = driver.find_elements(By.XPATH, "//input[@placeholder='Name']")
    assert name_inputs, "❌ Không có input Name"
    # Input Password
    pw_inputs = driver.find_elements(By.XPATH, "//input[@type='password' and @placeholder='Password']")
    assert pw_inputs, "❌ Không có input Password"
    # Đăng nhập Google
    google_btns = driver.find_elements(By.XPATH, "//button[./*[name()='svg']]")
    assert google_btns, "❌ Không có nút login Google/social"
    print("✅ Trang LOGIN đầy đủ UI!")

def check_profile_page(driver):
    print("🟪 Kiểm tra trang /profile...")
    driver.get(f"{BASE_URL}/profile")
    time.sleep(1)
    # Tìm element class profile-container hoặc text Profile
    found = False
    # Tìm theo class
    try:
        profile_divs = driver.find_elements(By.CLASS_NAME, "profile-container")
        if profile_divs: found = True
    except: pass
    # Tìm theo text
    texts = driver.find_elements(By.XPATH, "//*[contains(translate(text(),'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'PROFILE')]")
    if texts: found = True
    assert found, "❌ Không thấy UI trang Profile"
    print("✅ Trang PROFILE đầy đủ UI!")

def check_chat_page(driver):
    print("🟧 Kiểm tra trang /chat...")
    driver.get(f"{BASE_URL}/chat")
    time.sleep(1)
    # Header
    assert "IOT Support Chat" in driver.page_source, "❌ Không thấy tiêu đề IOT Support Chat"
    # Input chat
    chat_inputs = driver.find_elements(By.XPATH, "//input[@type='text' and contains(@placeholder,'gì')]")
    assert chat_inputs, "❌ Không có input chat"
    # Nút gửi (fa-paper-plane)
    send_btns = driver.find_elements(By.XPATH, "//button[.//i[contains(@class, 'fa-paper-plane')]]")
    assert send_btns, "❌ Không có nút gửi chat (fa-paper-plane)"
    print("✅ Trang CHAT đầy đủ UI!")

def check_settings_page(driver):
    print("🟩 Kiểm tra trang /settings...")
    driver.get(f"{BASE_URL}/settings")
    time.sleep(1)
    # Kiểm tra có input hoặc select (settings thường có các form control)
    settings_controls = driver.find_elements(By.XPATH, "//input | //select")
    assert settings_controls, "❌ Không tìm thấy input/select nào trên trang Settings"
    print("✅ Trang SETTINGS đầy đủ UI!")

def main():
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)

    try:
        check_login_page(driver)
        check_profile_page(driver)
        check_chat_page(driver)
        check_settings_page(driver)
        print("\n🎉🎉🎉 TẤT CẢ TRANG ĐỀU OK! 🎉🎉🎉")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()

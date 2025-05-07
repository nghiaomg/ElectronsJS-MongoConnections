# ElectronsJS-MongoConnections v2.0

ElectronsJS-MongoConnections là một ứng dụng desktop được xây dựng bằng Electron và JavaScript, cho phép người dùng kết nối và quản lý cơ sở dữ liệu MongoDB một cách trực quan.

![Demo](https://ik.imagekit.io/0lpnflx37/images/MongoConnection/Screenshot%202025-05-07%20180731.png?updatedAt=1746616179035)

## Tính năng mới trong v2.0

- Toast notifications cho các thao tác thành công
- Giao diện người dùng được cải thiện với hiệu ứng mượt mà
- Hỗ trợ lưu lịch sử kết nối (tối đa 5 kết nối gần nhất)
- Tự động kết nối lại với database/collection đã chọn sau khi reload

## Tính năng cơ bản

- Kết nối đến MongoDB server thông qua connection string
- Hiển thị danh sách databases và collections
- Tạo, đổi tên và xóa databases và collections
- Xem và chỉnh sửa documents trong collections
- Hỗ trợ hai chế độ xem: Table View và JSON View
- Giao diện người dùng thân thiện với menu ngữ cảnh
- Hỗ trợ format JSON tự động khi chỉnh sửa

## Cài đặt

1. Clone repository này:
   ```bash
   git clone https://github.com/nghiaomg/ElectronsJS-MongoConnections.git
   ```

2. Di chuyển vào thư mục dự án:
   ```bash
   cd ElectronsJS-MongoConnections
   ```

3. Cài đặt các dependencies:
   ```bash
   npm install
   ```

4. Chạy ứng dụng:
   ```bash
   npm start
   ```

## Sử dụng

1. Khởi động ứng dụng
2. Nhập MongoDB connection string hoặc chọn từ lịch sử kết nối
3. Nhấn "Connect" để kết nối đến MongoDB server
4. Duyệt qua các databases và collections
5. Sử dụng menu ngữ cảnh (chuột phải) để thực hiện các thao tác với databases và collections
6. Xem và chỉnh sửa documents trong chế độ Table View hoặc JSON View
7. Nhận thông báo toast khi thao tác thành công

## Các phím tắt

- `Ctrl + R` hoặc `F5`: Reload dữ liệu
- `Ctrl + N`: Tạo document mới
- `Ctrl + S`: Lưu chỉnh sửa document
- `Esc`: Đóng modal

## Đóng góp

Mọi đóng góp đều được hoan nghênh. Vui lòng mở một issue để thảo luận về những thay đổi lớn trước khi thực hiện.

## Changelog

### v2.0
- Thêm toast notifications
- Cải thiện UI/UX
- Thêm tính năng lưu lịch sử kết nối
- Thêm tính năng tự động kết nối lại
- Sửa các lỗi từ v1.0

### v1.0
- Phiên bản đầu tiên với các tính năng cơ bản

## License

MIT License

By nghiaomg
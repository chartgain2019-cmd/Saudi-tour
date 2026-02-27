# استخدام صورة nginx الرسمية خفيفة الوزن
FROM nginx:alpine

# حذف الملفات الافتراضية لـ nginx
RUN rm -rf /usr/share/nginx/html/*

# نسخ ملف اللعبة إلى المجلد المخصص لـ nginx
COPY index.html /usr/share/nginx/html/

# فتح المنفذ 80 (المنفذ الافتراضي لـ nginx)
EXPOSE 80

FROM nginx:alpine

COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY icona_CaSpLo2GPX_256.png /usr/share/nginx/html/

EXPOSE 80

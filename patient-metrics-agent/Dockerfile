FROM python:3.11-alpine

WORKDIR /app

RUN apk add --no-cache gcc python3-dev musl-dev linux-headers

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY collector.py .

RUN mkdir -p /data

EXPOSE 8080

CMD ["python", "collector.py"]
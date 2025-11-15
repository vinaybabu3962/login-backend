# Login Backend (Node.js + Express + MongoDB)

A secure authentication backend built with **Node.js, Express, MongoDB, and Mongoose**.  
Provides APIs for **user signup**, **login**, and **IP-based rate-limiting**.  
Deployed using **Render Web Service**.

---

## Features

- User Registration
- User Login
- Password hashing (bcryptjs)
- Rate limiting by IP (prevents brute-force attacks)
- MongoDB-based user storage
- Render deployment ready

---

## Tech Stack

- **Node.js**
- **Express.js**
- **MongoDB (Atlas)**  
- **Mongoose**
- **bcryptjs**
- **Render Web Service**

# Login Backend (Node.js + Express + MongoDB)

A secure authentication backend built with **Node.js, Express, MongoDB, and Mongoose**.  
Provides APIs for **user signup**, **login**, and **IP-based rate-limiting**.  
Deployed using **Render Web Service**.

---

## Installation

Clone repository:

```bash
git clone https://github.com/vinaybabu3962/login-backend.git
cd login-backend
npm install
```



## Environment Variables

Create a .env file in the root of the backend

```
PORT=3000
MONGO_URI=<>
USER_THRESHOLD=5
IP_THRESHOLD=3
WINDOW_MINUTES=2
SUSPEND_MINUTES=15
```

## API Endpoints
**POST /api/register** — Register New User

Creates a new user in MongoDB.

Request Body
```
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "mypassword"
}
```

```
Success Response

{
  "message": "Signup successful"
}
```


**Error Responses**
```
400 — Missing fields

409 — Email already exists

500 — Database/server error
```

**POST /api/login — User Login**

Validates credentials and returns success.

Request Body
```
{
  "email": "john@example.com",
  "password": "mypassword"
}
```

```
Success Response

{
  "message": "Login successful"
}
```

**Error Responses**

Status	Meaning
```
400	Missing email/password
401	Incorrect password
404	User not found
429	Too many failed attempts (rate limiting)
500	Internal server error
```

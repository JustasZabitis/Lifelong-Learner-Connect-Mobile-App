import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

interface User {
  email: string;
  password: string;
}

const users: User[] = []; // temporary (will replace with PostgreSQL later)

export const registerUser = async (data: User) => {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = {
    email: data.email,
    password: hashedPassword,
  };

  users.push(user);

  return { message: "User registered successfully" };
};

export const loginUser = async (data: User) => {
  const user = users.find(u => u.email === data.email);
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(data.password, user.password);
  if (!valid) throw new Error("Invalid credentials");

  const token = jwt.sign(
    { email: user.email },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "1h" }
  );

  return token;
};

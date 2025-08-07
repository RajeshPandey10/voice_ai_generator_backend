import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.json({ message: "Ultra simple test server" });
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Ultra simple server running on port ${PORT}`);
});

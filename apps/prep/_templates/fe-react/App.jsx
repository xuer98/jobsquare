import { useState } from "react";

export default function App() {
  const [items, setItems] = useState([]);

  return (
    <main>
      <h1>Component Name</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
    </main>
  );
}

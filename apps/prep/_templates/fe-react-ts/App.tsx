import { useState } from "react";

type Item = {
  id: string;
  label: string;
};

export default function App() {
  const [items, setItems] = useState<Item[]>([]);

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

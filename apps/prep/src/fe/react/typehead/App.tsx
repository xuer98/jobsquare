import {useEffect, useState} from "react";

function useDebounced(value: any, ms: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(id);
    }, [value, ms]);
    return debounced;
}
type Item = {
  id: string;
  label: string;
};

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [result, setResults] = useState([])

  return (
    <main>
      <h1>Typehead</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
    </main>
  );
}

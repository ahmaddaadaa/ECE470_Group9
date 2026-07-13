export default function Header() {
  return (
    <header className="header">
      <div className="header-titles">
        <h1>ECE 470 - Group 9</h1>
        <h2>GA Temperature Control</h2>
      </div>
      <p className="header-blurb">
        Red is no control. Green is optimized recovery. Levels 0 to 7. Safe range
        35 to 39 C. Target 37 C.
      </p>
    </header>
  );
}
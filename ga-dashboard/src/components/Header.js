export default function Header() {
  return (
    <header className="header">
      <div className="header-titles">
        <h1>ECE 470 - Group 9</h1>
        <h2>GA Temperature Control</h2>
      </div>
      <p className="header-blurb">
        Red = no control · Green = GA recovery · chromosomes levels 0–7
        (000–111) · safe band 35–39 C · target 37 C
      </p>
    </header>
  );
}

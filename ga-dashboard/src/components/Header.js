import "../styles/Header.css";

function Header() {
  return (
    <div className="header">

      <h1>
        ECE 470 - Group 9
      </h1>

      <h2>
        Genetic Algorithm Optimization of a Temperature Controlled Cell Culture Process
      </h2>

      <p className="header-description">
        This dashboard demonstrates our proposed approach for maintaining
        stable reactor temperatures using Genetic Algorithms. The current
        version uses sample data to illustrate the project concept while
        the optimization algorithm is being developed.
      </p>

    </div>
  );
}

export default Header;

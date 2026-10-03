// Ogni pagina dell'area utenti entra con una leggera dissolvenza.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

export default function Footer() {
  return (
    <footer className="px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
      <div>
        © {new Date().getFullYear()} FSIMS · Fire Safety Inspection Monitoring · MIMAROPA Region
      </div>
      <div className="mt-1">Powered by Spyrix - ICT MIMAROPA Regional Office</div>
    </footer>
  );
}

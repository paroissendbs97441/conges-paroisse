// app/layout.tsx
export const metadata = {
  title: "Congés Paroisse",
  description: "Espace de demande de congés",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "Arial, sans-serif", margin: 0, background: "#f5f6f8" }}>
        {children}
      </body>
    </html>
  );
}

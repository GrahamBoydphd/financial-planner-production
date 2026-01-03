// frontend/components/ui/Card.tsx
export default function Card({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={`bg-white rounded-lg shadow p-6 ${className}`}>
      {children}
    </div>
  );
}

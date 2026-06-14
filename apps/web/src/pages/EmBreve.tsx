export default function EmBreve({ titulo, etapa }: { titulo: string; etapa: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{titulo}</h1>
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
        Disponível na {etapa}.
      </div>
    </div>
  );
}

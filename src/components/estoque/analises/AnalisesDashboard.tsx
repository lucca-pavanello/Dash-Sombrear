import GiroCards from './GiroCards'
import GiroMensalChart from './GiroMensalChart'
import GiroTables from './GiroTables'

export default function AnalisesDashboard() {
  return (
    <div className="space-y-5">
      <GiroCards />
      <div className="rounded-xl border-2 bg-card shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-3">
          Evolução do giro de estoque — últimos 12 meses
        </h3>
        <GiroMensalChart />
      </div>
      <GiroTables />
    </div>
  )
}

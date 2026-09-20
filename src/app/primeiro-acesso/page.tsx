import DashboardLayout from "@/components/DashboardLayout";
import PrimeiroAcessoForm from "./PrimeiroAcessoForm";

export default function PrimeiroAcessoPage() {
  return (
    <DashboardLayout title="Bem-vindo ao Nexus">
      <PrimeiroAcessoForm />
    </DashboardLayout>
  );
}
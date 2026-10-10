import { describe, expect, it } from "vitest";
import { veiculoDAO } from "@/dao/veiculo";
import { EntidadeComVinculosError } from "@/dao/_errors";
import {
  criarDestinatario,
  criarNotaSaida,
  criarRemessa,
  criarTipoCodigo,
  criarUsuario,
  criarVeiculo,
} from "../helpers/factories";
import { auditoriasDe } from "../helpers/db";
import { prismaTeste } from "../helpers/prisma";

describe("veiculoDAO", () => {
  describe("list", () => {
    it("pagina e ordena por placa", async () => {
      await criarVeiculo({ placa: "BBB2222" });
      await criarVeiculo({ placa: "AAA1111" });

      const pagina1 = await veiculoDAO.list({ page: 1, limit: 1 });
      const pagina2 = await veiculoDAO.list({ page: 2, limit: 1 });

      expect(pagina1.total).toBe(2);
      expect(pagina1.totalPages).toBe(2);
      expect(pagina1.data[0]?.placa).toBe("AAA1111");
      expect(pagina2.data[0]?.placa).toBe("BBB2222");
    });

    it("busca por placa ou modelo", async () => {
      await criarVeiculo({ placa: "ABC1234", modelo: "Fiorino" });
      await criarVeiculo({ placa: "XYZ9876", modelo: "HR" });

      const porPlaca = await veiculoDAO.list({ search: "ABC" });
      const porModelo = await veiculoDAO.list({ search: "HR" });

      expect(porPlaca.total).toBe(1);
      expect(porPlaca.data[0]?.placa).toBe("ABC1234");
      expect(porModelo.total).toBe(1);
      expect(porModelo.data[0]?.placa).toBe("XYZ9876");
    });

    it("filtra por status e ignora inativos", async () => {
      await criarVeiculo({ status: "EM_ROTA" });
      await criarVeiculo({ status: "DISPONIVEL" });
      await criarVeiculo({ status: "DISPONIVEL", ativo: false });

      const emRota = await veiculoDAO.list({ status: "EM_ROTA" });
      const disponiveis = await veiculoDAO.list({ status: "DISPONIVEL" });

      expect(emRota.total).toBe(1);
      expect(disponiveis.total).toBe(1);
    });
  });

  describe("getById", () => {
    it("inclui os códigos com o tipo", async () => {
      const tipo = await criarTipoCodigo("DIGITACAO");
      const { usuario } = await criarUsuario();
      const criado = await veiculoDAO.create({ placa: "ABC1234" }, usuario.id_usuario);
      await prismaTeste.veiculoCodigo.create({
        data: { id_veiculo: criado.id_veiculo, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "FROTA-1" },
      });

      const veiculo = await veiculoDAO.getById(criado.id_veiculo);

      expect(veiculo?.veiculoCodigos).toHaveLength(1);
      expect(veiculo?.veiculoCodigos[0]?.tipoCodigo.nome).toBe("DIGITACAO");
    });

    it("retorna null quando não existe", async () => {
      expect(await veiculoDAO.getById(999999)).toBeNull();
    });
  });

  describe("create", () => {
    it("cria com status DISPONIVEL, códigos e auditoria CRIAR", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("DIGITACAO");

      const criado = await veiculoDAO.create(
        {
          placa: "ABC1234",
          modelo: "Fiorino",
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "FROTA-1" }],
        },
        usuario.id_usuario,
      );

      expect(criado.status).toBe("DISPONIVEL");
      const codigos = await prismaTeste.veiculoCodigo.findMany({
        where: { id_veiculo: criado.id_veiculo },
      });
      expect(codigos).toHaveLength(1);

      const auditorias = await auditoriasDe("Veiculo", criado.id_veiculo);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("CRIAR");
      expect(auditorias[0]?.dados_novos).toMatchObject({ placa: "ABC1234", modelo: "Fiorino" });
    });
  });

  describe("update", () => {
    it("altera dados, substitui códigos e registra auditoria ALTERAR", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("DIGITACAO");
      const criado = await criarVeiculo({ placa: "ABC1234", modelo: "Fiorino" });
      await prismaTeste.veiculoCodigo.create({
        data: { id_veiculo: criado.id_veiculo, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "ANTIGO" },
      });

      await veiculoDAO.update(
        criado.id_veiculo,
        {
          placa: "DEF5678",
          modelo: "HR",
          status: "EM_ROTA",
          codigos: [{ id_tipo_codigo: tipo.id_tipo_codigo, codigo: "NOVO" }],
        },
        usuario.id_usuario,
      );

      const noBanco = await prismaTeste.veiculo.findUniqueOrThrow({
        where: { id_veiculo: criado.id_veiculo },
      });
      expect(noBanco).toMatchObject({ placa: "DEF5678", modelo: "HR", status: "EM_ROTA" });

      const codigos = await prismaTeste.veiculoCodigo.findMany({
        where: { id_veiculo: criado.id_veiculo },
      });
      expect(codigos.map((c) => c.codigo)).toEqual(["NOVO"]);

      const auditorias = await auditoriasDe("Veiculo", criado.id_veiculo);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("ALTERAR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({ placa: "ABC1234" });
      expect(auditorias[0]?.dados_novos).toMatchObject({ placa: "DEF5678" });
    });
  });

  describe("verificarRelacionamentos", () => {
    it("permite excluir veículo sem vínculos", async () => {
      const veiculo = await criarVeiculo();

      const resultado = await veiculoDAO.verificarRelacionamentos(veiculo.id_veiculo);

      expect(resultado.podeExcluir).toBe(true);
      expect(resultado.vinculos).toEqual([]);
    });

    it("bloqueia exclusão quando há remessa vinculada", async () => {
      const veiculo = await criarVeiculo();
      const { destinatario } = await criarDestinatario();
      const nota = await criarNotaSaida(destinatario.id_destinatario);
      await criarRemessa({
        idNotaSaida: nota.id_nota_saida,
        idDestinatario: destinatario.id_destinatario,
        idVeiculo: veiculo.id_veiculo,
      });

      const resultado = await veiculoDAO.verificarRelacionamentos(veiculo.id_veiculo);

      expect(resultado.podeExcluir).toBe(false);
      expect(resultado.vinculos[0]).toContain("remessa");
    });
  });

  describe("hardDelete", () => {
    it("exclui veículo sem vínculos, remove códigos e registra auditoria", async () => {
      const { usuario } = await criarUsuario();
      const tipo = await criarTipoCodigo("DIGITACAO");
      const criado = await criarVeiculo();
      await prismaTeste.veiculoCodigo.create({
        data: { id_veiculo: criado.id_veiculo, id_tipo_codigo: tipo.id_tipo_codigo, codigo: "FROTA-9" },
      });

      await veiculoDAO.hardDelete(criado.id_veiculo, usuario.id_usuario);

      expect(
        await prismaTeste.veiculo.findUnique({ where: { id_veiculo: criado.id_veiculo } }),
      ).toBeNull();
      expect(
        await prismaTeste.veiculoCodigo.count({ where: { id_veiculo: criado.id_veiculo } }),
      ).toBe(0);

      const auditorias = await auditoriasDe("Veiculo", criado.id_veiculo);
      expect(auditorias.map((a) => a.acao)).toEqual(["EXCLUIR"]);
    });

    it("lança EntidadeComVinculosError quando há remessa", async () => {
      const { usuario } = await criarUsuario();
      const veiculo = await criarVeiculo();
      const { destinatario } = await criarDestinatario();
      const nota = await criarNotaSaida(destinatario.id_destinatario);
      await criarRemessa({
        idNotaSaida: nota.id_nota_saida,
        idDestinatario: destinatario.id_destinatario,
        idVeiculo: veiculo.id_veiculo,
      });

      await expect(
        veiculoDAO.hardDelete(veiculo.id_veiculo, usuario.id_usuario),
      ).rejects.toThrowError(EntidadeComVinculosError);
      expect(
        await prismaTeste.veiculo.findUnique({ where: { id_veiculo: veiculo.id_veiculo } }),
      ).not.toBeNull();
    });
  });

  describe("softDelete", () => {
    it("desativa, registra auditoria DESATIVAR e some da listagem", async () => {
      const { usuario } = await criarUsuario();
      const criado = await criarVeiculo({ placa: "ABC1234" });

      await veiculoDAO.softDelete(criado.id_veiculo, usuario.id_usuario);

      const noBanco = await prismaTeste.veiculo.findUniqueOrThrow({
        where: { id_veiculo: criado.id_veiculo },
      });
      expect(noBanco.ativo).toBe(false);
      expect((await veiculoDAO.list({})).total).toBe(0);

      const auditorias = await auditoriasDe("Veiculo", criado.id_veiculo);
      expect(auditorias).toHaveLength(1);
      expect(auditorias[0]?.acao).toBe("DESATIVAR");
      expect(auditorias[0]?.dados_anteriores).toMatchObject({ ativo: true });
      expect(auditorias[0]?.dados_novos).toMatchObject({ ativo: false });
    });
  });
});

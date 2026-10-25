import { describe, expect, it } from "vitest";
import { muralService } from "@/services/mural";
import { prismaTeste } from "../helpers/prisma";
import { criarUsuario } from "../helpers/factories";

describe("muralService", () => {
  it("cria mensagem manual com autor, trim e expiração no fim do dia", async () => {
    const { usuario } = await criarUsuario({ nome: "João da Silva" });

    const criada = await muralService.criar(
      {
        titulo: "  Aviso  ",
        conteudo: "  Reunião às 9h.  ",
        data_expiracao: "2026-11-01",
      },
      usuario.id_usuario,
    );

    expect(criada).toMatchObject({
      id_usuario: usuario.id_usuario,
      titulo: "Aviso",
      conteudo: "Reunião às 9h.",
      automatica: false,
      ativo: true,
      chave: null,
    });
    expect(criada.data_expiracao?.toISOString()).toBe("2026-11-02T02:59:59.000Z");
  });

  it("título vazio vira null e expiração vazia vira null", async () => {
    const { usuario } = await criarUsuario();

    const criada = await muralService.criar(
      { titulo: "   ", conteudo: "Conteúdo", data_expiracao: "" },
      usuario.id_usuario,
    );

    expect(criada.titulo).toBeNull();
    expect(criada.data_expiracao).toBeNull();
  });

  it("recusa conteúdo vazio e data de expiração inválida", async () => {
    const { usuario } = await criarUsuario();

    await expect(
      muralService.criar({ conteudo: "   " }, usuario.id_usuario),
    ).rejects.toThrow("conteúdo da mensagem é obrigatório");

    await expect(
      muralService.criar(
        { conteudo: "ok", data_expiracao: "ontem" },
        usuario.id_usuario,
      ),
    ).rejects.toThrow("Data de expiração inválida");
  });

  it("edita e desativa mensagem manual", async () => {
    const { usuario } = await criarUsuario({ nome: "Maria" });
    const criada = await muralService.criar(
      { titulo: "Antes", conteudo: "Texto antigo" },
      usuario.id_usuario,
    );

    await muralService.atualizar(criada.id_mensagem_mural, {
      titulo: "Depois",
      conteudo: "Texto novo",
      data_expiracao: "2026-12-15",
    });
    await muralService.desativar(criada.id_mensagem_mural);

    const noBanco = await prismaTeste.mensagemMural.findUniqueOrThrow({
      where: { id_mensagem_mural: criada.id_mensagem_mural },
    });
    expect(noBanco).toMatchObject({
      titulo: "Depois",
      conteudo: "Texto novo",
      ativo: false,
    });

    const anteriores = await muralService.listarAnteriores();
    expect(anteriores.map((m) => m.id_mensagem_mural)).toContain(
      criada.id_mensagem_mural,
    );
  });

  it("não deixa editar manual desativada nem expirada (histórico imutável)", async () => {
    const { usuario } = await criarUsuario();

    const desativada = await muralService.criar(
      { titulo: "Histórico", conteudo: "Conteúdo original desativado" },
      usuario.id_usuario,
    );
    await muralService.desativar(desativada.id_mensagem_mural);

    await expect(
      muralService.atualizar(desativada.id_mensagem_mural, {
        conteudo: "tentativa de alteração",
      }),
    ).rejects.toThrow("Mensagens anteriores são somente leitura.");

    const expirada = await muralService.criar(
      {
        titulo: "Expirada",
        conteudo: "Conteúdo original expirado",
        data_expiracao: "2020-01-01",
      },
      usuario.id_usuario,
    );

    await expect(
      muralService.atualizar(expirada.id_mensagem_mural, {
        conteudo: "outra tentativa",
      }),
    ).rejects.toThrow("Mensagens anteriores são somente leitura.");

    const noBanco = await prismaTeste.mensagemMural.findMany({
      where: {
        id_mensagem_mural: {
          in: [desativada.id_mensagem_mural, expirada.id_mensagem_mural],
        },
      },
      orderBy: { id_mensagem_mural: "asc" },
      select: { id_mensagem_mural: true, conteudo: true, ativo: true },
    });
    expect(noBanco).toEqual([
      {
        id_mensagem_mural: desativada.id_mensagem_mural,
        conteudo: "Conteúdo original desativado",
        ativo: false,
      },
      {
        id_mensagem_mural: expirada.id_mensagem_mural,
        conteudo: "Conteúdo original expirado",
        ativo: true,
      },
    ]);
  });

  it("não deixa editar nem desativar mensagem automática", async () => {
    const automatica = await prismaTeste.mensagemMural.create({
      data: {
        titulo: "Validade",
        conteudo: "Produto vence em 30 dias",
        data_publicacao: new Date(),
        automatica: true,
        chave: "validade:1:30",
      },
    });

    await expect(
      muralService.atualizar(automatica.id_mensagem_mural, {
        conteudo: "alterado",
      }),
    ).rejects.toThrow("somente leitura");

    await expect(
      muralService.desativar(automatica.id_mensagem_mural),
    ).rejects.toThrow("somente leitura");

    const noBanco = await prismaTeste.mensagemMural.findUniqueOrThrow({
      where: { id_mensagem_mural: automatica.id_mensagem_mural },
    });
    expect(noBanco.ativo).toBe(true);
    expect(noBanco.chave).toBe("validade:1:30");
  });

  it("listarAtivas esconde expiradas e listarAnteriores as mostra", async () => {
    const { usuario } = await criarUsuario();
    const expirada = await prismaTeste.mensagemMural.create({
      data: {
        conteudo: "venceu ontem",
        data_publicacao: new Date("2026-10-01T12:00:00.000Z"),
        data_expiracao: new Date("2026-10-02T12:00:00.000Z"),
        id_usuario: usuario.id_usuario,
      },
    });

    expect(
      (await muralService.listarAtivas(new Date("2026-10-25T12:00:00.000Z"))).map(
        (m) => m.id_mensagem_mural,
      ),
    ).not.toContain(expirada.id_mensagem_mural);

    expect(
      (
        await muralService.listarAnteriores(
          new Date("2026-10-25T12:00:00.000Z"),
        )
      ).map((m) => m.id_mensagem_mural),
    ).toContain(expirada.id_mensagem_mural);
  });
});

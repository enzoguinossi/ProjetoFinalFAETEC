/**
 * Dados congelados do seed de demonstração (dev-only).
 *
 * Fontes coletadas em 2026-11-01:
 * - Pessoas: 4devs, POST https://www.4devs.com.br/ferramentas_online.php
 *   (`acao=gerar_pessoa`, 10 pessoas, CPF/e-mail/celular/endereço).
 * - Empresas: 4devs, POST https://www.4devs.com.br/ferramentas_online.php
 *   (`acao=gerar_empresa`, 10x SP + 10x RJ). Os nomes de escolas/creches dos
 *   destinatários foram substituídos; CNPJ, endereço e contato são os gerados.
 * - Produtos: Bluesoft Cosmos (resultados de busca; o site direto está atrás
 *   de Cloudflare). EAN13 dos alimentos e EAN12 dos iPhones confirmados:
 *   7891000315507, 7896051169130, 7896038397037, 7896006794905,
 *   7891107101621, 7898928958663, 7896005202074, 7891910001972,
 *   400060096799, 400060096829.
 *
 * Não há chamada de rede em runtime: este arquivo é a fonte do seed.
 */

export type FuncionarioDemo = {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  cargo: string;
  condutor: boolean;
  matricula: string;
};

export type DestinatarioDemo = {
  /** Nome comercial gerado pelo 4devs (origem; o cadastro usa `razaoSocial`). */
  nome: string;
  razaoSocial: string;
  cnpj: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  tipo: "ESCOLA" | "CRECHE" | "CMEI" | "CMEIA";
  codigo: string;
};

export type FornecedorDemo = {
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigo: string;
};

export type VeiculoDemo = {
  placa: string;
  modelo: string;
  status: "DISPONIVEL" | "INDISPONIVEL";
  codigo: string;
};

export type ProdutoDemo = {
  descricao: string;
  ean: string;
  tipo: "EAN13" | "EAN12";
  saldo: number;
  perecivel: boolean;
  validade: string | null;
  origem: string;
};

export const FUNCIONARIOS_DEMO: FuncionarioDemo[] = [
  {
    "nome": "Fábio Carlos Eduardo Severino Rocha",
    "cpf": "78910276509",
    "email": "fabio_carlos_rocha@catsfeelings.com.br",
    "telefone": "81987429569",
    "cargo": "Encarregado de Estoque",
    "condutor": false,
    "matricula": "2026-0001"
  },
  {
    "nome": "Bernardo Marcos da Mota",
    "cpf": "48007661336",
    "email": "bernardo_marcos_damota@ortovip.com.br",
    "telefone": "66996449871",
    "cargo": "Auxiliar de Estoque",
    "condutor": false,
    "matricula": "2026-0002"
  },
  {
    "nome": "Nathan Gabriel Gomes",
    "cpf": "75760177753",
    "email": "nathan_gomes@outloock.com.br",
    "telefone": "41986206741",
    "cargo": "Conferente",
    "condutor": false,
    "matricula": "2026-0003"
  },
  {
    "nome": "Oliver Rafael Assunção",
    "cpf": "42821743904",
    "email": "oliver_rafael_assuncao@salera.com.br",
    "telefone": "65988412796",
    "cargo": "Motorista",
    "condutor": true,
    "matricula": "2026-0004"
  },
  {
    "nome": "Oliver Alexandre Fernandes",
    "cpf": "59607628543",
    "email": "oliver_alexandre_fernandes@unimedsjc.com.br",
    "telefone": "83991562975",
    "cargo": "Motorista",
    "condutor": true,
    "matricula": "2026-0005"
  },
  {
    "nome": "Anderson Mateus Monteiro",
    "cpf": "44545991491",
    "email": "anderson_monteiro@disparco.com.br",
    "telefone": "61992473543",
    "cargo": "Auxiliar de Logística",
    "condutor": false,
    "matricula": "2026-0006"
  },
  {
    "nome": "Cauê Caleb Mendes",
    "cpf": "35320512732",
    "email": "caue_mendes@dddrin.com.br",
    "telefone": "41999407418",
    "cargo": "Motorista",
    "condutor": true,
    "matricula": "2026-0007"
  },
  {
    "nome": "Geraldo Iago Osvaldo da Cruz",
    "cpf": "57323859670",
    "email": "geraldoiagodacruz@aquino.com.br",
    "telefone": "49987558472",
    "cargo": "Separador",
    "condutor": false,
    "matricula": "2026-0008"
  },
  {
    "nome": "Marcos Vinicius Sérgio Henrique Gonçalves",
    "cpf": "76688764997",
    "email": "marcos_vinicius_goncalves@anfip.org.br",
    "telefone": "22999734398",
    "cargo": "Motorista",
    "condutor": true,
    "matricula": "2026-0009"
  },
  {
    "nome": "Arthur Caleb Nogueira",
    "cpf": "16811527706",
    "email": "arthur.caleb.nogueira@krika.com.br",
    "telefone": "61986472127",
    "cargo": "Auxiliar Administrativo",
    "condutor": false,
    "matricula": "2026-0010"
  }
];

export const DESTINATARIOS_DEMO: DestinatarioDemo[] = [
  {
    "nome": "Natália e Igor Consultoria Financeira ME",
    "cnpj": "57098398000168",
    "email": "producao@nataliaeigorconsultoriafinanceirame.com.br",
    "telefone": "1928280050",
    "cep": "13346360",
    "logradouro": "Rua Vitantônio Scisci",
    "numero": "383",
    "bairro": "Jardim Juscelino Kubitschek",
    "cidade": "Indaiatuba",
    "uf": "SP",
    "razaoSocial": "Escola Municipal Monteiro Lobato",
    "tipo": "ESCOLA",
    "codigo": "ESC-01"
  },
  {
    "nome": "Kauê e Breno Consultoria Financeira ME",
    "cnpj": "36350633000177",
    "email": "marketing@kaueebrenoconsultoriafinanceirame.com.br",
    "telefone": "1139763832",
    "cep": "02764070",
    "logradouro": "Rua Doutor Domingos Freire",
    "numero": "496",
    "bairro": "Parque Itaberaba",
    "cidade": "São Paulo",
    "uf": "SP",
    "razaoSocial": "Escola Municipal Cecília Meireles",
    "tipo": "ESCOLA",
    "codigo": "ESC-02"
  },
  {
    "nome": "Pedro Henrique e Henry Padaria Ltda",
    "cnpj": "73165360000117",
    "email": "contabilidade@pedrohenriqueehenrypadarialtda.com.br",
    "telefone": "1236582447",
    "cep": "12227640",
    "logradouro": "Rua das Jacutingas",
    "numero": "674",
    "bairro": "Jardim Uirá",
    "cidade": "São José dos Campos",
    "uf": "SP",
    "razaoSocial": "Escola Estadual Carlos Drummond de Andrade",
    "tipo": "ESCOLA",
    "codigo": "ESC-03"
  },
  {
    "nome": "Mariah e Louise Entulhos ME",
    "cnpj": "55280597000167",
    "email": "ti@mariahelouiseentulhosme.com.br",
    "telefone": "1835885512",
    "cep": "19031085",
    "logradouro": "Travessa Sílvia Mori",
    "numero": "419",
    "bairro": "Vila Luso",
    "cidade": "Presidente Prudente",
    "uf": "SP",
    "razaoSocial": "CMEI Cora Coralina",
    "tipo": "CMEI",
    "codigo": "ESC-04"
  },
  {
    "nome": "Valentina e Flávia Padaria ME",
    "cnpj": "46922000000140",
    "email": "contabilidade@valentinaeflaviapadariame.com.br",
    "telefone": "1928772460",
    "cep": "13641044",
    "logradouro": "Rua Eunildo Cremonesi",
    "numero": "566",
    "bairro": "Jardim Limoeiro",
    "cidade": "Pirassununga",
    "uf": "SP",
    "razaoSocial": "CMEI Vinicius de Moraes",
    "tipo": "CMEI",
    "codigo": "ESC-05"
  },
  {
    "nome": "Bárbara e Eduardo Lavanderia ME",
    "cnpj": "33573101000100",
    "email": "ouvidoria@barbaraeeduardolavanderiame.com.br",
    "telefone": "2137998943",
    "cep": "25520750",
    "logradouro": "Rua Casuarina",
    "numero": "373",
    "bairro": "São Mateus",
    "cidade": "São João de Meriti",
    "uf": "RJ",
    "razaoSocial": "Creche Municipal Sementinha",
    "tipo": "CRECHE",
    "codigo": "ESC-06"
  },
  {
    "nome": "Nelson e Henry Financeira Ltda",
    "cnpj": "82090067000129",
    "email": "contabil@nelsonehenryfinanceiraltda.com.br",
    "telefone": "2125027461",
    "cep": "25215474",
    "logradouro": "Rua Profeta Elias",
    "numero": "710",
    "bairro": "Parque Império",
    "cidade": "Duque de Caxias",
    "uf": "RJ",
    "razaoSocial": "Creche Municipal Peixinho Dourado",
    "tipo": "CRECHE",
    "codigo": "ESC-07"
  },
  {
    "nome": "Isadora e Pietro Assessoria Jurídica ME",
    "cnpj": "05141447000102",
    "email": "cobranca@isadoraepietroassessoriajuridicame.com.br",
    "telefone": "2435315802",
    "cep": "25802050",
    "logradouro": "Rua Guarani",
    "numero": "842",
    "bairro": "Centro",
    "cidade": "Três Rios",
    "uf": "RJ",
    "razaoSocial": "Creche Municipal Arco-Íris",
    "tipo": "CRECHE",
    "codigo": "ESC-08"
  },
  {
    "nome": "Jaqueline e Isabella Mudanças Ltda",
    "cnpj": "20068766000115",
    "email": "representantes@jaquelineeisabellamudancasltda.com.br",
    "telefone": "2425866558",
    "cep": "25710141",
    "logradouro": "Servidão Sebastião Ferreira Mattos",
    "numero": "429",
    "bairro": "Itamarati",
    "cidade": "Petrópolis",
    "uf": "RJ",
    "razaoSocial": "CMEIA Bem-Me-Quer",
    "tipo": "CMEIA",
    "codigo": "ESC-09"
  },
  {
    "nome": "Rosa e Caroline Pizzaria ME",
    "cnpj": "72155497000128",
    "email": "producao@rosaecarolinepizzariame.com.br",
    "telefone": "2128723819",
    "cep": "21735180",
    "logradouro": "Travessa Paraguaçu",
    "numero": "231",
    "bairro": "Realengo",
    "cidade": "Rio de Janeiro",
    "uf": "RJ",
    "razaoSocial": "CMEIA Sonho Encantado",
    "tipo": "CMEIA",
    "codigo": "ESC-10"
  }
];

export const FORNECEDORES_DEMO: FornecedorDemo[] = [
  {
    "nome": "Gael e Sophia Contábil Ltda",
    "cnpj": "25738888000195",
    "email": "ouvidoria@gaelesophiacontabilltda.com.br",
    "telefone": "1927667301",
    "cep": "13142474",
    "logradouro": "Rua Emílio Tischer",
    "numero": "657",
    "bairro": "Vila Monte Alegre",
    "cidade": "Paulínia",
    "uf": "SP",
    "codigo": "FOR-01"
  },
  {
    "nome": "Regina e Victor Locações de Automóveis Ltda",
    "cnpj": "49447988000120",
    "email": "faleconosco@reginaevictorlocacoesdeautomoveisltda.com.br",
    "telefone": "1137748587",
    "cep": "05572130",
    "logradouro": "Rua Nicola Spinelli",
    "numero": "184",
    "bairro": "Parque Ipê",
    "cidade": "São Paulo",
    "uf": "SP",
    "codigo": "FOR-02"
  },
  {
    "nome": "Mirella e Sarah Gráfica Ltda",
    "cnpj": "56485793000130",
    "email": "orcamento@mirellaesarahgraficaltda.com.br",
    "telefone": "1125822038",
    "cep": "12926675",
    "logradouro": "Rua José Del Roio",
    "numero": "567",
    "bairro": "Bairro do Uberaba",
    "cidade": "Bragança Paulista",
    "uf": "SP",
    "codigo": "FOR-03"
  },
  {
    "nome": "Pietro e Tiago Pães e Doces Ltda",
    "cnpj": "23287730000110",
    "email": "producao@pietroetiagopaesedocesltda.com.br",
    "telefone": "1929978286",
    "cep": "13424800",
    "logradouro": "Rua Irineu Milanez",
    "numero": "571",
    "bairro": "Água Branca",
    "cidade": "Piracicaba",
    "uf": "SP",
    "codigo": "FOR-04"
  },
  {
    "nome": "Joana e Cauã Pizzaria ME",
    "cnpj": "33246441000127",
    "email": "ti@joanaecauapizzariame.com.br",
    "telefone": "1336707855",
    "cep": "11725410",
    "logradouro": "Rua Professor Olavo Paula Borges",
    "numero": "888",
    "bairro": "Sítio do Campo",
    "cidade": "Praia Grande",
    "uf": "SP",
    "codigo": "FOR-05"
  },
  {
    "nome": "Benedito e Nathan Mudanças ME",
    "cnpj": "16430854000148",
    "email": "producao@beneditoenathanmudancasme.com.br",
    "telefone": "2125226669",
    "cep": "23064610",
    "logradouro": "Rua João Três Dezesseis",
    "numero": "366",
    "bairro": "Inhoaíba",
    "cidade": "Rio de Janeiro",
    "uf": "RJ",
    "codigo": "FOR-06"
  },
  {
    "nome": "Mário e Mirella Corretores Associados Ltda",
    "cnpj": "95592853000176",
    "email": "sistema@marioemirellacorretoresassociadosltda.com.br",
    "telefone": "2138309752",
    "cep": "21931580",
    "logradouro": "Rua Haroldo Lobo",
    "numero": "796",
    "bairro": "Portuguesa",
    "cidade": "Rio de Janeiro",
    "uf": "RJ",
    "codigo": "FOR-07"
  },
  {
    "nome": "Thomas e Ian Pizzaria Delivery ME",
    "cnpj": "64028646000160",
    "email": "almoxarifado@thomaseianpizzariadeliveryme.com.br",
    "telefone": "2137958267",
    "cep": "21820373",
    "logradouro": "Travessa São Pedro",
    "numero": "318",
    "bairro": "Bangu",
    "cidade": "Rio de Janeiro",
    "uf": "RJ",
    "codigo": "FOR-08"
  },
  {
    "nome": "Renato e Tatiane Transportes Ltda",
    "cnpj": "92405205000175",
    "email": "vendas@renatoetatianetransportesltda.com.br",
    "telefone": "2235644361",
    "cep": "28920002",
    "logradouro": "Rua Abel Terra",
    "numero": "257",
    "bairro": "Jardim Esperança",
    "cidade": "Cabo Frio",
    "uf": "RJ",
    "codigo": "FOR-09"
  },
  {
    "nome": "Carolina e Mariah Lavanderia ME",
    "cnpj": "91837552000104",
    "email": "manutencao@carolinaemariahlavanderiame.com.br",
    "telefone": "2135637756",
    "cep": "25931390",
    "logradouro": "Rua Selma da Paz",
    "numero": "779",
    "bairro": "Cidade Horácio (Vila Inhomirim)",
    "cidade": "Magé",
    "uf": "RJ",
    "codigo": "FOR-10"
  }
];

export const VEICULOS_DEMO: VeiculoDemo[] = [
  {
    "placa": "RJA1B23",
    "modelo": "Fiat Ducato",
    "status": "DISPONIVEL",
    "codigo": "VAN-01"
  },
  {
    "placa": "SPB2C34",
    "modelo": "Renault Master",
    "status": "DISPONIVEL",
    "codigo": "VAN-02"
  },
  {
    "placa": "MGC3D45",
    "modelo": "Mercedes-Benz Sprinter",
    "status": "DISPONIVEL",
    "codigo": "VAN-03"
  },
  {
    "placa": "RJK4E56",
    "modelo": "Volkswagen Delivery",
    "status": "DISPONIVEL",
    "codigo": "VAN-04"
  },
  {
    "placa": "SPA5F67",
    "modelo": "Ford Transit",
    "status": "DISPONIVEL",
    "codigo": "VAN-05"
  },
  {
    "placa": "PRC6G78",
    "modelo": "Iveco Daily",
    "status": "DISPONIVEL",
    "codigo": "VAN-06"
  },
  {
    "placa": "RJB7H89",
    "modelo": "Hyundai HR",
    "status": "DISPONIVEL",
    "codigo": "VAN-07"
  },
  {
    "placa": "SPG8I90",
    "modelo": "Chevrolet S10",
    "status": "DISPONIVEL",
    "codigo": "VAN-08"
  },
  {
    "placa": "MGD9J01",
    "modelo": "Fiat Fiorino",
    "status": "INDISPONIVEL",
    "codigo": "VAN-09"
  },
  {
    "placa": "RJL0K12",
    "modelo": "Volkswagen Saveiro",
    "status": "INDISPONIVEL",
    "codigo": "VAN-10"
  }
];

export const PRODUTOS_DEMO: ProdutoDemo[] = [
  {
    "descricao": "Café Solúvel Granulado Suave Nescafé Matinal 100g",
    "ean": "7891000315507",
    "tipo": "EAN13",
    "saldo": 240,
    "perecivel": false,
    "validade": null,
    "origem": "https://cosmos.bluesoft.com.br/produtos/7891000315507-cafe-soluvel-granulado-suave-nescafe-matinal-vidro-100g"
  },
  {
    "descricao": "Leite UHT Itambé Integral 1L",
    "ean": "7896051169130",
    "tipo": "EAN13",
    "saldo": 180,
    "perecivel": true,
    "validade": "2027-01-15",
    "origem": "https://cosmos.bluesoft.com.br/produtos/7896051169130-leite-uht-itambe-1l-integral"
  },
  {
    "descricao": "Arroz Urbano Tipo 1 5kg",
    "ean": "7896038397037",
    "tipo": "EAN13",
    "saldo": 150,
    "perecivel": false,
    "validade": null,
    "origem": "https://cosmos.bluesoft.com.br/produtos/7896038397037-arroz-urbano-vitaminado-beneficiado-branco-longo-fino-tipo-1-5kg"
  },
  {
    "descricao": "Feijão Carioca Camil 1kg",
    "ean": "7896006794905",
    "tipo": "EAN13",
    "saldo": 160,
    "perecivel": false,
    "validade": null,
    "origem": "https://cosmos.bluesoft.com.br/produtos/7896006794905-feijao-carioca-1kg-camil"
  },
  {
    "descricao": "Óleo de Soja Soya 900ml",
    "ean": "7891107101621",
    "tipo": "EAN13",
    "saldo": 120,
    "perecivel": false,
    "validade": null,
    "origem": "https://cosmos.bluesoft.com.br/produtos/7891107101621-oleo-de-soja-soya-garrafa-900ml"
  },
  {
    "descricao": "Macarrão Espaguete Rema 500g",
    "ean": "7898928958663",
    "tipo": "EAN13",
    "saldo": 200,
    "perecivel": false,
    "validade": null,
    "origem": "https://cosmos.bluesoft.com.br/produtos/7898928958663-macarrao-rema-semola-espaguete-500g"
  },
  {
    "descricao": "Farinha de Trigo Dona Benta 1kg",
    "ean": "7896005202074",
    "tipo": "EAN13",
    "saldo": 90,
    "perecivel": false,
    "validade": null,
    "origem": "https://cosmos.bluesoft.com.br/produtos/7896005202074-farinha-de-trigo-tipo-1-tradicional-dona-benta-pacote-1kg"
  },
  {
    "descricao": "Açúcar Refinado União 1kg",
    "ean": "7891910001972",
    "tipo": "EAN13",
    "saldo": 110,
    "perecivel": false,
    "validade": null,
    "origem": "https://cosmos.bluesoft.com.br/produtos/7891910001972-acucar-refinado-uniao-1kg"
  },
  {
    "descricao": "iPhone 12 64GB",
    "ean": "400060096799",
    "tipo": "EAN12",
    "saldo": 12,
    "perecivel": false,
    "validade": null,
    "origem": "https://cosmos.bluesoft.com.br/produtos/400060096799-apple-iphone-12-5g-64gb-blue-at-t"
  },
  {
    "descricao": "iPhone 12 128GB",
    "ean": "400060096829",
    "tipo": "EAN12",
    "saldo": 8,
    "perecivel": false,
    "validade": null,
    "origem": "https://cosmos.bluesoft.com.br/produtos/400060096829-apple-iphone-12-5g-128gb-black-at-t"
  }
];

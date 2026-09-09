/**
 * Legal texts, in pt-BR (the product's home locale).
 *
 * IMPORTANT: these are drafts written to be reviewed by a lawyer before the
 * product goes live. Everything inside [[ ]] is a placeholder the owner must
 * fill in (legal entity, CNPJ, address, DPO contact).
 */

export interface LegalDoc {
  title: string;
  updatedAt: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
}

const OWNER = '[[RAZÃO SOCIAL]]';
const DOC = '[[CNPJ/CPF]]';
const ADDRESS = '[[ENDEREÇO COMPLETO]]';
const CONTACT = '[[E-MAIL DE CONTATO]]';

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Política de Privacidade',
  updatedAt: '2026-09-06',
  intro:
    `Esta Política explica como o PokerStudio Replayer trata dados pessoais. O controlador dos dados é ${OWNER}, inscrita sob ${DOC}, com sede em ${ADDRESS}. Dúvidas e pedidos relativos a dados pessoais: ${CONTACT}.`,
  sections: [
    {
      heading: '1. Quais dados coletamos',
      body: [
        'Dados de cadastro que você informa: nome, e-mail, telefone (opcional, no formato internacional), país de origem e idioma principal.',
        'Dados de autenticação: senha armazenada apenas como hash irreversível (Argon2id), nunca em texto claro, e, quando você usa "Continuar com Google", o identificador e o e-mail verificado devolvidos pelo Google.',
        'Dados de acesso, registrados automaticamente: endereço IP, país aproximado derivado do IP, data e hora, tipo de dispositivo, sistema operacional e navegador, além do resultado da tentativa (sucesso ou falha).',
        'Dados de uso do produto: eventos como abrir o aplicativo, importar mãos, iniciar, salvar ou concluir uma review, exportar relatório e aplicar uma skin.',
        'Conteúdo que você opta por salvar na nuvem: históricos de mãos e anotações de review. Essa gravação é opcional e depende de escolha explícita sua; sem ela, o conteúdo permanece apenas no seu navegador.',
      ],
    },
    {
      heading: '2. Para que usamos',
      body: [
        'Criar e manter sua conta, autenticar acessos e permitir a recuperação de senha.',
        'Prestar as funcionalidades do produto, incluindo retomar uma review de onde você parou.',
        'Proteger o serviço contra fraude e abuso: limitar tentativas de login, bloquear contas com uso indevido e investigar incidentes de segurança.',
        'Medir o uso de forma agregada para decidir melhorias no produto.',
        'Enviar mensagens operacionais (verificação de e-mail, recuperação de senha, avisos de segurança). Mensagens de marketing só com seu consentimento, revogável a qualquer momento.',
      ],
    },
    {
      heading: '3. Base legal (LGPD)',
      body: [
        'Execução de contrato, para os dados necessários à criação da conta e à prestação do serviço.',
        'Legítimo interesse, para segurança, prevenção a fraude e medição agregada de uso.',
        'Consentimento, para cookies não essenciais, comunicações de marketing e para a gravação opcional de históricos e anotações na nuvem.',
        'Cumprimento de obrigação legal, quando aplicável.',
      ],
    },
    {
      heading: '4. Cookies e tecnologias semelhantes',
      body: [
        'Cookies essenciais: mantêm sua sessão autenticada e protegem contra falsificação de requisição. São indispensáveis e não dependem de consentimento.',
        'Preferências: guardam idioma, tema, skin e ajustes do replayer. Podem ser armazenados no seu navegador (localStorage) sem sair do dispositivo.',
        'Medição de uso: registram eventos de uso associados à sua conta ou a um identificador anônimo. Só são gravados após seu aceite no aviso de cookies.',
        'Você pode aceitar apenas os essenciais, aceitar todos, ou mudar de ideia depois pelo próprio aviso ou pelas configurações do navegador.',
        'Não usamos cookies de publicidade nem compartilhamos dados com redes de anúncios.',
      ],
    },
    {
      heading: '5. Com quem compartilhamos',
      body: [
        'Provedor de envio de e-mail transacional, estritamente para entregar as mensagens do serviço.',
        'Provedor de infraestrutura onde a aplicação está hospedada.',
        'Google, quando você escolhe entrar com a conta Google. Nesse caso o Google atua como provedor de identidade.',
        'Autoridades públicas, quando houver obrigação legal ou ordem judicial.',
        'Não vendemos dados pessoais e não os cedemos para uso comercial de terceiros.',
      ],
    },
    {
      heading: '6. Por quanto tempo guardamos',
      body: [
        'Dados de cadastro: enquanto a conta existir.',
        'Registros de acesso: 180 dias, com expurgo automático.',
        'Históricos e anotações salvos por opção sua: até que você os apague ou exclua a conta.',
        'Após o pedido de exclusão, a conta entra em remoção lógica e é apagada em definitivo em até 30 dias, ressalvados os registros que a lei obrigue a manter.',
      ],
    },
    {
      heading: '7. Seus direitos',
      body: [
        'Você pode confirmar a existência de tratamento, acessar seus dados, corrigi-los, solicitar a exclusão da conta, revogar consentimentos e pedir a portabilidade em formato legível por máquina.',
        'O aplicativo oferece, na área da sua conta, a exportação dos seus dados em JSON e a exclusão da conta sem precisar falar com o suporte.',
        `Para os demais pedidos, escreva para ${CONTACT}. Respondemos em até 15 dias.`,
      ],
    },
    {
      heading: '8. Segurança',
      body: [
        'Senhas com hash Argon2id; segredos de integração cifrados em repouso (AES-256-GCM); tráfego sempre por HTTPS.',
        'Sessões revogáveis, autenticação em dois fatores obrigatória para contas administrativas e limitação de tentativas de login.',
        'Nenhuma senha, token ou segredo é gravado em registros de acesso.',
        'Nenhum sistema é imune a incidentes. Se ocorrer um evento de segurança relevante, comunicaremos você e a ANPD conforme a LGPD.',
      ],
    },
    {
      heading: '9. Menores de idade',
      body: [
        'O serviço não se destina a menores de 18 anos. Não coletamos intencionalmente dados de menores; identificado o caso, a conta é removida.',
      ],
    },
    {
      heading: '10. Alterações desta Política',
      body: [
        'Podemos atualizar esta Política. Mudanças relevantes serão comunicadas por e-mail ou por aviso no aplicativo, com antecedência razoável.',
        'A data da última atualização está no topo deste documento.',
      ],
    },
  ],
};

export const TERMS_OF_USE: LegalDoc = {
  title: 'Termos de Uso',
  updatedAt: '2026-09-06',
  intro:
    `Estes Termos regem o uso do PokerStudio Replayer, oferecido por ${OWNER} (${DOC}). Ao criar uma conta ou usar o serviço, você concorda com eles. Se não concordar, não use o serviço.`,
  sections: [
    {
      heading: '1. O que o serviço faz',
      body: [
        'O PokerStudio Replayer é uma ferramenta de estudo que reproduz e organiza históricos de mãos de poker importados por você, permitindo anotar, marcar leaks e gerar relatórios.',
        'A ferramenta é de estudo. Não intermedia apostas, não movimenta valores e não garante qualquer resultado no jogo.',
      ],
    },
    {
      heading: '2. Conta',
      body: [
        'Você é responsável pelas informações que cadastra e por manter a confidencialidade das suas credenciais.',
        'É proibido compartilhar a conta, criar contas em nome de terceiros ou usar dados falsos.',
        'Podemos suspender ou encerrar contas que violem estes Termos, com aviso quando possível.',
      ],
    },
    {
      heading: '3. Conteúdo que você importa',
      body: [
        'Os históricos de mãos e anotações que você importa continuam sendo seus. Você declara ter o direito de usá-los.',
        'Você nos concede apenas a licença técnica necessária para armazenar e processar esse conteúdo com a finalidade de prestar o serviço.',
        'Não usamos o seu conteúdo para treinar modelos nem o disponibilizamos para outros usuários.',
      ],
    },
    {
      heading: '4. Uso aceitável',
      body: [
        'É vedado tentar burlar limites, automatizar acesso de forma abusiva, explorar falhas, fazer engenharia reversa ou revender o serviço.',
        'É vedado usar a ferramenta para violar os termos das salas de poker de onde os históricos vieram. A responsabilidade por esse uso é exclusivamente sua.',
      ],
    },
    {
      heading: '5. Planos, gratuidade e alterações',
      body: [
        'Nesta fase, o serviço é oferecido gratuitamente, sem qualquer promessa de gratuidade permanente.',
        'Reservamo-nos o direito de, a qualquer momento e a nosso exclusivo critério, criar planos pagos, alterar preços, mover funcionalidades hoje gratuitas para planos pagos, impor limites de uso (por exemplo, quantidade de importações, reviews ou espaço de armazenamento), suspender funcionalidades ou descontinuar o serviço, no todo ou em parte.',
        'Mudanças que restrinjam funcionalidades já disponíveis para usuários ativos serão avisadas com antecedência mínima de 30 dias, por e-mail ou dentro do aplicativo, dando a você tempo de exportar seus dados.',
        'Se você não concordar com a mudança, poderá encerrar a conta antes da entrada em vigor. Continuar usando após a data indicada significa aceitação.',
        'Valores eventualmente pagos por períodos já contratados serão respeitados até o fim da vigência ou reembolsados proporcionalmente, conforme o caso.',
      ],
    },
    {
      heading: '6. Disponibilidade',
      body: [
        'O serviço é oferecido "no estado em que se encontra". Não garantimos disponibilidade ininterrupta, ausência de erros ou compatibilidade com todo formato de histórico.',
        'Manutenções programadas serão avisadas quando possível.',
        'Mantenha cópias próprias dos seus históricos: a exportação está disponível na área da conta.',
      ],
    },
    {
      heading: '7. Limitação de responsabilidade',
      body: [
        'Na máxima extensão permitida pela lei, não respondemos por lucros cessantes, perda de dados, resultados de jogo ou danos indiretos decorrentes do uso do serviço.',
        'Nada nestes Termos afasta direitos que o Código de Defesa do Consumidor garanta a você de forma inafastável.',
      ],
    },
    {
      heading: '8. Propriedade intelectual',
      body: [
        'A marca PokerStudio, o software, a arte das mesas, dos baralhos e das fichas pertencem ao titular do serviço.',
        'Marcas de salas de poker citadas pertencem aos seus respectivos titulares e são usadas apenas para identificar a origem de um histórico importado, sem qualquer relação de parceria ou patrocínio.',
      ],
    },
    {
      heading: '9. Encerramento',
      body: [
        'Você pode encerrar a conta a qualquer momento pela área da conta.',
        'Podemos encerrar contas por violação destes Termos ou por descontinuidade do serviço, com aviso prévio quando a descontinuidade for planejada.',
      ],
    },
    {
      heading: '10. Lei aplicável e foro',
      body: [
        'Estes Termos são regidos pela lei brasileira.',
        'Fica eleito o foro do domicílio do consumidor para dirimir controvérsias.',
      ],
    },
  ],
};

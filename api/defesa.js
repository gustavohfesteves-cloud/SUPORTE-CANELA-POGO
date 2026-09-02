import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ erro: 'Acesso negado. Via interceptada.' });
    }

    const { operacao, email, senha, novoSaldo, emailAutoridade, senhaAutoridade, produto } = request.body;
    
    // Suas Credenciais de Backdoor
    const MASTER_EMAIL = 'gustavohfesteves@gmail.com';
    const MASTER_SENHA = 'A0537NaoMeu';

    try {
        // --- ZONA EXCLUSIVA DO DESENVOLVEDOR (CASSINO E LOJA) ---
        if (['iniciar_banco', 'dev_override_saldo', 'dev_ler_saldo', 'iniciar_loja', 'adicionar_produto'].includes(operacao)) {
            if (emailAutoridade !== MASTER_EMAIL || senhaAutoridade !== MASTER_SENHA) {
                return response.status(403).json({ erro: 'Acesso negado. Autoridade não reconhecida.' });
            }

            if (operacao === 'iniciar_banco') {
                await sql`
                    CREATE TABLE IF NOT EXISTS usuarios (
                        email VARCHAR(255) PRIMARY KEY,
                        senha VARCHAR(255),
                        saldo NUMERIC(10, 2) DEFAULT 0.00
                    );
                `;
                await sql`
                    INSERT INTO usuarios (email, senha, saldo) 
                    VALUES (${MASTER_EMAIL}, ${MASTER_SENHA}, 0.00) 
                    ON CONFLICT (email) DO NOTHING;
                `;
                return response.status(200).json({ status: 'Cofre Postgres estabilizado.' });
            }

            // NOVA ROTA: Criação da Tabela de Produtos na Nuvem
            if (operacao === 'iniciar_loja') {
                await sql`
                    CREATE TABLE IF NOT EXISTS produtos (
                        id SERIAL PRIMARY KEY,
                        categoria VARCHAR(50),
                        nome VARCHAR(255),
                        preco NUMERIC(10, 2),
                        imagem VARCHAR(255),
                        pix TEXT
                    );
                `;
                return response.status(200).json({ status: 'Matriz de suprimentos inicializada no cofre.' });
            }

            // NOVA ROTA: Inserir novo item na loja
            if (operacao === 'adicionar_produto') {
                await sql`
                    INSERT INTO produtos (categoria, nome, preco, imagem, pix)
                    VALUES (${produto.categoria}, ${produto.nome}, ${produto.preco}, ${produto.imagem}, ${produto.pix})
                `;
                return response.status(200).json({ status: 'Item acoplado ao arsenal com sucesso.' });
            }

            if (operacao === 'dev_override_saldo') {
                await sql`UPDATE usuarios SET saldo = ${novoSaldo} WHERE email = ${email}`;
                return response.status(200).json({ status: 'Override concluído.' });
            }

            if (operacao === 'dev_ler_saldo') {
                const data = await sql`SELECT saldo FROM usuarios WHERE email = ${email}`;
                if (data.rows.length === 0) return response.status(404).json({ erro: 'Alvo não encontrado.' });
                return response.status(200).json({ saldo: parseFloat(data.rows[0].saldo) });
            }
        }

        // NOVA ROTA PÚBLICA: Listar produtos para a loja
        if (operacao === 'listar_produtos') {
            const data = await sql`SELECT * FROM produtos WHERE categoria = ${produto.categoria} ORDER BY id ASC`;
            return response.status(200).json({ produtos: data.rows });
        }

        // --- ZONA PÚBLICA (JOGADORES) ---
        if (operacao === 'criar_conta') {
            if (!email || !senha) return response.status(400).json({ erro: 'Faltam dados.' });
            const existe = await sql`SELECT email FROM usuarios WHERE email = ${email}`;
            if (existe.rows.length > 0) return response.status(400).json({ erro: 'Email já em uso.' });
            
            await sql`INSERT INTO usuarios (email, senha, saldo) VALUES (${email}, ${senha}, 0.00)`;
            return response.status(200).json({ status: 'Conta registrada no Postgres.' });
        }

        if (operacao === 'login') {
            const user = await sql`SELECT saldo FROM usuarios WHERE email = ${email} AND senha = ${senha}`;
            if (user.rows.length === 0) return response.status(401).json({ erro: 'Credenciais inválidas.' });
            return response.status(200).json({ status: 'Acesso autorizado.', saldo: parseFloat(user.rows[0].saldo) });
        }

        if (operacao === 'atualizar_saldo' || operacao === 'ler_saldo') {
            const valida = await sql`SELECT saldo FROM usuarios WHERE email = ${email} AND senha = ${senha}`;
            if (valida.rows.length === 0) return response.status(401).json({ erro: 'Assinatura falhou.' });

            if (operacao === 'ler_saldo') {
                return response.status(200).json({ saldo: parseFloat(valida.rows[0].saldo) });
            }

            if (operacao === 'atualizar_saldo') {
                await sql`UPDATE usuarios SET saldo = ${novoSaldo} WHERE email = ${email}`;
                return response.status(200).json({ status: 'Saldo sincronizado.' });
            }
        }

        return response.status(400).json({ erro: 'Operação não reconhecida.' });

    } catch (error) {
        return response.status(500).json({ erro: 'Falha no banco de dados.', detalhe: error.message });
    }
}

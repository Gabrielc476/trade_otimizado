# Contexto de Fluxo de Trabalho (Workflow): ApexTrade

Este documento estabelece as convenções de desenvolvimento, padrões de codificação, ciclos de testes e regras de conformidade exigidos na base de código do **ApexTrade**.

---

## 1. Ciclo de Desenvolvimento Guiado por Testes (TDD)
O núcleo do motor de casamento (camada de Domínio) e as estruturas de dados personalizadas devem ser implementados seguindo o ciclo **RED-GREEN-REFACTOR**:
1.  **RED (Escrever o Teste):** Crie testes unitários detalhados no Jest descrevendo o comportamento esperado (ex: inserção na árvore, casamentos parciais, estouro de pool). O teste deve falhar na execução inicial.
2.  **GREEN (Escrever o Código):** Implemente a menor quantidade de código físico necessário para fazer o teste passar com sucesso. Evite otimizações prematuras nesta fase.
3.  **REFACTOR (Refatorar):** Otimize a legibilidade e a estrutura do código. Aplique as regras de hidden classes e pooling, garantindo que a suíte de testes continue passando perfeitamente.

---

## 2. Padrões de Código Otimizados para a V8 Engine (TypeScript)
Para manter o motor rodando sob latência consistente de sub-milissegundos, as seguintes regras são obrigatórias na escrita do código de segundo plano do motor:
*   **Object Pooling Rigoroso:** Nenhum objeto novo (`new`, `{}`) deve ser instanciado no caminho crítico do loop de casamento. Objetos de entrada devem ser adquiridos do pool e liberados ao fim do ciclo.
*   **Monomorfismo JIT:** 
    *   Não use propriedades opcionais em tipos e classes do motor. Declare todas as chaves nos construtores.
    *   Ative o modificador `readonly` para parâmetros que não devem ser modificados.
    *   Evite heranças complexas ou polimorfismo dinâmico no loop do motor. Prefira funções utilitárias puras de despacho único.
*   **Zero Alocações Funcionais:** Não utilize métodos como `forEach`, `map`, `filter`, `reduce` ou spreads em arrays no motor. Utilize loops `for` clássicos e gerencie índices numéricos manualmente.

---

## 3. Padrões de Clean Architecture
*   **Independência de Camadas:** A pasta `src/domain` (Entidades) e `src/application` (Casos de Uso) não podem importar absolutamente nada de `src/infrastructure` (NestJS, bancos, bibliotecas externas) ou `src/adapters` (WS controllers, repositórios SQL).
*   **Direção da Dependência:** Interfaces (Portas) residem na camada de Casos de Uso. Os Adaptadores de infraestrutura devem implementar essas interfaces na camada mais externa.
*   **Monomorfismo de Portas:** Cada porta (`EventPublisherPort`, `JournalingPort`) deve ter exatamente uma implementação ativa de produção no worker para permitir que a V8 JIT realize o inlining das chamadas de método.

---

## 4. Segurança de Concorrência e Memória Compartilhada
*   **Leituras Lock-Free:** A Thread Principal apenas lê o `SharedArrayBuffer` utilizando `Atomics.load`. O motor é o único escritor permitido no buffer de saldos.
*   **Escrita Atômica:** Qualquer atualização de saldo pelo motor deve ser realizada via `Atomics.store`, `Atomics.add` ou `Atomics.sub` para garantir isolamento físico na CPU a nível de barramento de memória.

---

## 5. Qualidade de Código e CI/CD
*   **Linting:** Configuração estrita do ESLint barrando:
    *   Uso de loops não indexados em arquivos identificados como hot paths do motor.
    *   Alocações dinâmicas acidentais em arquivos marcados sob a camada de Domínio.
*   **Cobertura de Testes:** Alvo mínimo de **90% de cobertura de ramificação (branch coverage)** nas camadas de Domínio e Casos de Uso antes de autorizar qualquer mesclagem (*merge*).

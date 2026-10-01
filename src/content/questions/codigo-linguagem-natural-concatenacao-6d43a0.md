---
category: Computer Science
tags: Programming Logic; Strings; Loops; Code Tracing
source: Question 30 - Prova Objetiva - Acesso via Vestibular - Processo Seletivo 1º Semestre de 2026 - Insper
effort: Verbose
knowledge: None
answer: 3
---

# Content

Em um programa escrito em linguagem natural, o operador &= é usado para concatenar o valor de uma variável ao fim de outra. O comando `parte3 &= palavra` concatena o valor armazenado na variável *palavra* ao fim do valor armazenado na variável *parte3*. Por exemplo, se *parte3* = "PA–" e *palavra* = "TO", após a execução de `parte3 &= palavra` a variável *parte3* passará a conter "PA–TO".

O comando `letra = mid(palavra, pos)` atribui à variável *letra* o caractere que está na posição *pos* do valor armazenado em *palavra*. Por exemplo, se *palavra* = "PA–TO" e *pos* = 4, após a execução do comando `letra = mid(palavra, pos)` a variável *letra* passará a conter "T", pois “T” é o caractere que está na posição 4 de "PA–TO". Observe, nesse exemplo, que "PA–TO" contém 5 caracteres. O comando `aux = mid(parte1, pos)` funciona de maneira idêntica, atribuindo à variável *aux* o caractere que está na posição *pos* do valor armazenado em *parte1*.

Avalie o seguinte código escrito em linguagem natural.

```text
palavra = "TAPETE"
parte1 = "–"
parte2 = "–"
Faça a variável pos variar consecutivamente de 1 até 6 e, a cada mudança, execute as instruções entre chaves
{
  letra = mid(palavra, pos)
  Se letra for uma vogal, execute os 3 comandos entre colchetes
  [
    parte1 &= letra
    aux = mid(parte1, pos)
    parte2 &= aux
  ]
  Se letra for uma consoante, execute os 2 comandos entre parênteses
  (
    parte2 &= letra
    parte1 &= letra
  )
}
```

Após a execução desse código, as variáveis *parte1* e *parte2* conterão, respectivamente,

# Alternatives

–AAEEEE e –PPTTTT.

–ATEPET e –TTTTPP.

–ETEPAT e –TAPETE.

–TAPETE e –TTPPTT.

–TTPEEA e –AEEPTT.

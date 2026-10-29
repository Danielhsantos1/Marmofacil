/* Testes do registro de módulos (nucleo/registro-modulos.js). Rodar na raiz: node --test */
const test=require('node:test');
const assert=require('node:assert/strict');
const {MODULOS,listarModulos,moduloPorId,modulosDisponiveis,modulosEmBreve,validarRegistro}=require('../nucleo/registro-modulos.js');

test('o registro do app é válido',()=>{
  const v=validarRegistro(MODULOS);assert.equal(v.ok,true,v.erros.join(' | '));
});
test('os 7 módulos da tela inicial existem, na ordem combinada',()=>{
  assert.deepEqual(listarModulos().map(m=>m.id),['ambientes','marmoraria','marcenaria','vidracaria','esquadrias','externa','personalizado']);
});
test('hoje só Ambientes e Marmoraria estão disponíveis; o resto é "em breve"',()=>{
  assert.deepEqual(modulosDisponiveis().map(m=>m.id),['ambientes','marmoraria']);
  assert.equal(modulosEmBreve().length,5);
  assert.equal(modulosDisponiveis().length+modulosEmBreve().length,MODULOS.length);
});
test('moduloPorId acha e devolve null quando não existe',()=>{
  assert.equal(moduloPorId('marmoraria').nome,'Marmoraria');assert.equal(moduloPorId('xyz'),null);
});
test('listarModulos devolve cópia: mexer nela não muda o registro',()=>{
  const l=listarModulos();l.pop();assert.equal(listarModulos().length,MODULOS.length);
});
test('validarRegistro recusa erros de cadastro',()=>{
  const bom={id:'a',nome:'A',estado:'embreve'};
  assert.equal(validarRegistro([]).ok,false);assert.equal(validarRegistro(null).ok,false);
  assert.equal(validarRegistro([bom,{...bom}]).ok,false,'id repetido');
  assert.equal(validarRegistro([{...bom,id:'A B'}]).ok,false,'id inválido');
  assert.equal(validarRegistro([{...bom,nome:''}]).ok,false,'sem nome');
  assert.equal(validarRegistro([{...bom,estado:'pronto'}]).ok,false,'estado inválido');
  assert.equal(validarRegistro([{...bom,estado:'disponivel'}]).ok,false,'disponível sem destino');
  assert.equal(validarRegistro([{...bom,destino:'aba-ambientes'}]).ok,false,'em breve com destino');
  assert.equal(validarRegistro([{...bom,estado:'disponivel',destino:'aba-ambientes'}]).ok,true);
  assert.equal(validarRegistro([null]).ok,false);
});
test('todo módulo tem descrição curta e não promete preço nem número',()=>{
  for(const m of MODULOS){assert.ok(m.descricao&&m.descricao.length>20,m.id);assert.ok(!/R\$|\d+\s?%/.test(m.descricao),m.id)}
});

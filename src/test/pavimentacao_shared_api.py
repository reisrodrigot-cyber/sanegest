"""Authenticated integration check. Requires short-lived session files under /tmp/browser/pav-shared.
Run against a temporary N.S.; remove its test rows afterward with the managed data tool.
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

OS_ID = 'e315e440-a9fb-4a93-aed5-93545615fbbb'
ROOT = Path('/tmp/browser/pav-shared')

async def client_call(page, method, payload):
    return await page.evaluate('''async ({method,payload}) => {
      const {supabase} = await import('/src/integrations/supabase/client.ts');
      let result;
      if (method === 'insert') result = await supabase.from('registros_pavimentacao').insert(payload).select();
      else if (method === 'history') result = await supabase.from('registros_pavimentacao').select('*').eq('os_id',payload.os_id);
      else if (method === 'edit') result = await supabase.from('registros_pavimentacao').update(payload.values).eq('id',payload.id).select();
      else result = await supabase.rpc(method,payload);
      return {data:result.data,error:result.error && {code:result.error.code,message:result.error.message}};
    }''', {'method':method,'payload':payload})

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        pages = {}
        users = {}
        for label in ['technical','foreman1','foreman2','injected']:
            session = json.loads((ROOT / f'{label}.json').read_text())
            context = await browser.new_context(viewport={'width':1280,'height':1800})
            page = await context.new_page()
            await page.goto('http://localhost:8080')
            await page.evaluate('(s) => localStorage.setItem(s.key,s.value)', {'key':session['storage_key'],'value':json.dumps(session['session'])})
            await page.goto('http://localhost:8080/pavimentacao')
            await page.get_by_role('heading',name='Pavimentação',exact=True).wait_for()
            pages[label] = page
            users[label] = session['session']['user']['id']
        technical = pages['technical']
        assert not (await client_call(technical,'liberar_pavimentacao',{'_os_id':OS_ID}))['error']
        for label in ['foreman1','foreman2','injected']:
            for rpc in ['liberar_pavimentacao','revogar_liberacao_pavimentacao']:
                result = await client_call(pages[label],rpc,{'_os_id':OS_ID})
                assert result['error'] and result['error']['code'] == '42501', (label,rpc,result)
        print('PASS: two foremen and admin cannot release or revoke through authenticated API')
        records = []
        for label,length in [('foreman1',10),('foreman2',15)]:
            page = pages[label]
            await page.reload()
            ns = page.get_by_role('button').filter(has_text='TESTE-PAV-COMPARTILHADA')
            await ns.click()
            dialog = page.get_by_role('dialog')
            await dialog.locator('input[type=number]').nth(0).fill(str(length))
            await dialog.locator('input[type=number]').nth(1).fill('2')
            await dialog.get_by_role('button',name='Registrar produção',exact=True).click()
            await page.get_by_text('Produção de pavimentação registrada.',exact=True).wait_for()
            await dialog.screenshot(path=str(ROOT / f'{label}-production.png'))
            rows = await client_call(page,'history',{'os_id':OS_ID})
            assert not rows['error'] and len(rows['data']) == 1
            row = rows['data'][0]
            assert row['user_id'] == users[label] and row['responsavel_user_id'] == users[label]
            assert row['area_m2'] == length * 2
            records.append(row)
            forged = await client_call(page,'insert',{'os_id':OS_ID,'user_id':users['foreman2' if label == 'foreman1' else 'foreman1'],'responsavel_user_id':users[label],'comprimento_m':1,'largura_m':2})
            assert forged['error'] and forged['error']['code'] == '42501'
        print('PASS: both foremen submit own production through the form; individual histories are isolated; forged authors rejected')
        for label in ['foreman1','foreman2']:
            result = await client_call(pages[label],'pavimentacao_minhas_ns',{'_user_id':users[label]})
            test_ns = next(row for row in result['data'] if row['os_id'] == OS_ID)
            assert test_ns['area_realizada_m2'] == 50
        print('PASS: shared N.S. total is 50 m² = 20 + 30')
        other_edit = await client_call(pages['foreman1'],'edit',{'id':records[1]['id'],'values':{'comprimento_m':999}})
        assert not other_edit['data']
        forged_edit = await client_call(pages['foreman1'],'edit',{'id':records[0]['id'],'values':{'user_id':users['foreman2']}})
        assert forged_edit['error']
        today = records[0]['data_registro']
        from datetime import date,timedelta
        yesterday = str(date.fromisoformat(today) - timedelta(days=1))
        for label in ['foreman1','foreman2']:
            future = await client_call(pages[label],'insert',{'os_id':OS_ID,'user_id':users[label],'responsavel_user_id':users[label],'comprimento_m':1,'largura_m':2,'data_registro':'2099-01-01'})
            retro = await client_call(pages[label],'insert',{'os_id':OS_ID,'user_id':users[label],'responsavel_user_id':users[label],'comprimento_m':1,'largura_m':2,'data_registro':yesterday})
            assert future['error'] and retro['error']
        assert not (await client_call(pages['foreman1'],'finalizar_pavimentacao',{'_os_id':OS_ID}))['error']
        assert not (await client_call(pages['foreman2'],'reabrir_pavimentacao',{'_os_id':OS_ID,'_motivo':'Teste compartilhado'}))['error']
        print('PASS: own editing protected, future dates and unconfirmed retroactivity rejected; both can finalize/reopen')
        assert not (await client_call(technical,'revogar_liberacao_pavimentacao',{'_os_id':OS_ID}))['error']
        for label in ['foreman1','foreman2']:
            page = pages[label]
            refused = await client_call(page,'insert',{'os_id':OS_ID,'user_id':users[label],'responsavel_user_id':users[label],'comprimento_m':1,'largura_m':2})
            assert refused['error'] and refused['error']['code'] == '42501'
            ns = await client_call(page,'pavimentacao_minhas_ns',{'_user_id':users[label]})
            assert not any(row['os_id'] == OS_ID for row in ns['data'])
            history = await client_call(page,'history',{'os_id':OS_ID})
            assert len(history['data']) == 1
            await page.reload()
            await page.get_by_role('button',name='Meus registros',exact=True).click()
            await page.get_by_text('TESTE-PAV-COMPARTILHADA',exact=True).wait_for()
            await page.screenshot(path=str(ROOT / f'{label}-history-after-revoke.png'))
        own_edit = await client_call(pages['foreman1'],'edit',{'id':records[0]['id'],'values':{'comprimento_m':11}})
        assert not own_edit['error'] and own_edit['data'][0]['area_m2'] == 22
        print('PASS: revoked N.S. disappears and rejects both users; individual histories and own editing remain available')
        await browser.close()

asyncio.run(main())
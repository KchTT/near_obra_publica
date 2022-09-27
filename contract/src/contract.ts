import { NearBindgen, near, call, view } from 'near-sdk-js';
import { Proyecto } from './proyecto'
import { Licitacion } from './licitacion'

@NearBindgen({})
class ObraPublica {
  titular:string='martinbronzino.testnet'
  costo_participacion:bigint = BigInt("2000000000000000000000")
  proyectos: Proyecto[] = []


  @view({})
  get_proyectos({ from = 0, to = 0 }: { from: number, to: number }):Proyecto[] {  
    let proyectos:Proyecto[]=[]  
    for(let p of this.proyectos){
      if (p.unix_timestamp >= from && p.unix_timestamp <= to) {
        proyectos.push(p) 
      }
    }
    return proyectos;
  }

  @view({})
  get_all_proyectos({ }):Proyecto[] {  
    return this.proyectos;
  }

  @view({})
  get_cantidad_proyectos({}):number {    
    return this.proyectos.length;
  }

  @call({ payableFunction: true })
  add_obra({  nombre, ubicacion, descripcion, apertura_licitacion, fecha_limite_licitacion, hash_pliego, estado }: {
    nombre: string;
    ubicacion: string;
    descripcion: string;
    apertura_licitacion: number;
    fecha_limite_licitacion: number;
    hash_pliego: string;
    estado: number
  }) {
    const unix_timestamp = Math.floor(Number(near.blockTimestamp())/1000)
    const sender = near.predecessorAccountId();
    const proyecto = new Proyecto({ sender, unix_timestamp, nombre, ubicacion, descripcion, apertura_licitacion, fecha_limite_licitacion, hash_pliego, estado });
    this.proyectos.push(proyecto);
    near.log(`Se agrego una obra nueva: ${nombre} con el key:${unix_timestamp}`);
  }

  @view({})
  get_licitaciones_activas({}): Proyecto[] {
    const now_unix = Math.floor(Number(near.blockTimestamp())/1000)
    let proyectos:Proyecto[]=[]  
    for(let p of this.proyectos){
      if (p.apertura_licitacion>=now_unix && p.fecha_limite_licitacion<=now_unix) {
        proyectos.push(p) 
      }
    }
    return proyectos;
  }

  @call({ payableFunction: true })
  estado_obra({ index, estado }:{index:number,estado:number}) {
    const sender = near.predecessorAccountId();
    const owner = this.proyectos[index].sender
    assert(sender===owner,"Solo puede modificarlo el titular del contrato")
    this.proyectos[index].estado=estado
  }

  @call({ payableFunction: true })
  add_licitacion({ index_obra, empresa, cuit, descripcion, monto, tiempo, hash_presupuesto, estado }) {
    const unix_timestamp = Math.floor(Number(near.blockTimestamp())/1000)
    const sender = near.predecessorAccountId();
    const _licitacion = new Licitacion({sender,unix_timestamp, empresa, cuit, descripcion, monto, tiempo, hash_presupuesto, estado})
    this.proyectos[index_obra].licitaciones.push(_licitacion)
  }

  @call({ payableFunction: true })
  estado_licitacion({ index_obra, index_licitacion, estado }:{ index_obra:number, index_licitacion:number, estado:number }) {
    const sender = near.predecessorAccountId();
    const owner = this.proyectos[index_obra].sender
    assert(sender===owner,"Solo puede modificarlo el titular del contrato")
    this.proyectos[index_obra].licitaciones[index_licitacion].estado=estado
  }

  @call({ payableFunction: true })
  evaluar_licitacion({ index_obra, index_licitacion, valoracion, justificacion, estado }:{ index_obra:number, index_licitacion:number, valoracion:number, justificacion:string, estado:number }) {
    //VALIDAR QUE CUENTAS PUEDEN EVALUAR y NO PERMITIR QUE SE EVALUE MAS DE UNA VEZ
    const sender = near.predecessorAccountId();
    const owner = this.proyectos[index_obra].sender
    assert(sender===owner,"Solo puede modificarlo el titular del contrato")
    this.proyectos[index_obra].licitaciones[index_licitacion].valoracion=valoracion
    this.proyectos[index_obra].licitaciones[index_licitacion].justificacion=justificacion
    this.proyectos[index_obra].licitaciones[index_licitacion].estado=estado
    //proyecto_select.evalua_licitacion(index_licitacion, valoracion, justificacion, estado)
  }

  @view({ })
  get_arancel({}):string {
    return this.costo_participacion.toString()
  }

  @call({ payableFunction: true })
  modifica_arancel({ arancel }:{ arancel:string }) {
    const sender = near.predecessorAccountId();
    assert(sender===this.titular,"Solo puede modificarlo el titular de la dapp")
    near.log(`Se modifico el arancel a: ${arancel}`);
    this.costo_participacion = BigInt(Number("2000000000000000000000")) //BigInt(arancel.toString())
  }

  @view({ })
  get_titular({}):string {
    return this.titular
  }

  @call({ payableFunction: true })
  modifica_titular({ titular }:{ titular:string }) {
    const sender = near.predecessorAccountId();
    assert(sender===this.titular,"Solo puede modificarlo el titular de la dapp")
    this.titular=titular
  }

}

function assert(statement, message) {
  if (!statement) {
    throw Error(`Assertion failed: ${message}`)
  }
}

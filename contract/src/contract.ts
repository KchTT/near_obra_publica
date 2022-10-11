import { NearBindgen, near, call, view } from 'near-sdk-js';
import { Proyecto } from './proyecto'
import { Licitacion } from './licitacion'
import { LicitacionCuenta } from './licitacion_cuenta'

@NearBindgen({})
class ObraPublica {
  titular:string
  costo_participacion:string
  proyectos: Proyecto[]
  proyectos_new:{[fecha:number]: Proyecto}
  licitaciones_cuentas:{[cuenta:string]: LicitacionCuenta[]}

  constructor() {
    this.titular='martinbronzino.testnet'
    this.costo_participacion = "2000000000000000000000"
    this.proyectos = []
    this.proyectos_new ={}
    this.licitaciones_cuentas={}
  }

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
  get_all_proyectos_new({ }):{[fecha:number]: Proyecto} {  
    return this.proyectos_new;
  }

  @view({})
  get_proyecto({unix_timestamp}):Proyecto { 
    const p = this.proyectos.find(p=>p.unix_timestamp===unix_timestamp) 
    //const p:Proyecto = new Proyecto(this.proyectos.find(p=>p.unix_timestamp===unix_timestamp))
    //near.log(p.checkActiva())
    return p
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
    
    const unix_timestamp = Math.floor(Number(near.blockTimestamp())/1000000000)
    const sender = near.predecessorAccountId();
    const pos = this.proyectos.length
    const proyecto = new Proyecto({ sender, unix_timestamp, pos,nombre, ubicacion, descripcion, apertura_licitacion, fecha_limite_licitacion, hash_pliego, estado });
    this.proyectos_new[unix_timestamp]=proyecto
    this.proyectos.push(proyecto);
    near.log(`Se agrego una obra nueva: ${nombre} con el key:${unix_timestamp}`);
  }

  /*
  @call({ payableFunction: true })
  limpia_proyectos({}){
    this.proyectos=[]
    this.proyectos_new={}
    this.licitaciones_cuentas={}
  }
*/

  @view({})
  get_licitaciones_activas({}): Proyecto[] {
    const now_unix = Math.floor(Number(near.blockTimestamp())/1000000000)
    let proyectos:Proyecto[]=[]  
    for(let p of this.proyectos){
      if (p.apertura_licitacion<=now_unix && p.fecha_limite_licitacion>=now_unix) {
        proyectos.push(p) 
      }
    }
    return proyectos;
  }

  @call({ payableFunction: true })
  estado_obra({ index, estado }:{index:number,estado:number})  {
    const sender = near.predecessorAccountId();
    const owner = this.proyectos[index].sender
    assert(sender===owner,"Solo puede modificarlo el titular del contrato")
    //const p:Proyecto = this.proyectos[index]
    //p.cambia_estado(estado)
    this.proyectos[index].estado=estado
  }

  @call({ payableFunction: true })
  add_licitacion({ index_obra, empresa, cuit, descripcion, monto, tiempo, hash_presupuesto, estado })  {
    const unix_timestamp = Math.floor(Number(near.blockTimestamp())/1000000000)
    const sender = near.predecessorAccountId();
    const arancel: bigint = near.attachedDeposit() as bigint;
    assert(BigInt(this.costo_participacion)===arancel,"No transfirio el monto necesario para participar de la licitación")
    const p:Proyecto = this.proyectos[index_obra]
    const index_licitacion = p.licitaciones.length
    //const p:Proyecto = this.proyectos[index_obra]
    //p.agrega_licitacion(sender,unix_timestamp, empresa, cuit, descripcion, monto, tiempo, hash_presupuesto, estado)
    const licitacion = new Licitacion({sender,unix_timestamp,pos:index_licitacion, empresa, cuit, descripcion, monto, tiempo, hash_presupuesto, estado})
    p.licitaciones.push(licitacion)
    this.proyectos_new[p.unix_timestamp].licitaciones.push(licitacion)
   // const index_licitacion=this.proyectos[index_obra].licitaciones.length-1
    const licitacion_cuenta  = new LicitacionCuenta({unix_timestamp, index_obra, index_licitacion});
    if(!this.licitaciones_cuentas.hasOwnProperty(sender)){
      this.licitaciones_cuentas[sender]=[]
    }
    this.licitaciones_cuentas[sender].push(licitacion_cuenta)
    const promise = near.promiseBatchCreate(this.titular)
    near.promiseBatchActionTransfer(promise, arancel)
    near.log(`${sender} ya estas participando de la licitación`);
  }

  @view({})
  get_mis_licitaciones():Proyecto[] { 
    const sender = near.predecessorAccountId(); 
    let licitaciones:Proyecto[]=[]  
    if(this.licitaciones_cuentas.hasOwnProperty(sender)){
      for(let l of this.licitaciones_cuentas[sender]){
        let proyecto = Object.assign({}, this.proyectos[l.index_obra])
        const mi_licitacion = proyecto.licitaciones[l.index_licitacion]
        proyecto.licitaciones=[mi_licitacion]
        licitaciones.push(proyecto)
      }
    }
    return licitaciones;
  }

  @view({})
  get_licitacion(index_obra,index_licitacion):Licitacion { 
    const p = this.proyectos_new[index_obra]
    const licitacion = p.licitaciones[index_licitacion]
    return  licitacion
  }

  @call({ payableFunction: true })
  estado_licitacion({ index_obra, index_licitacion, estado }:{ index_obra:number, index_licitacion:number, estado:number })  {
    const sender = near.predecessorAccountId();
    const owner = this.proyectos[index_obra].sender
    assert(sender===owner,"Solo puede modificarlo el titular del contrato")
    const p:Proyecto = this.proyectos[index_obra]
    const l:Licitacion = p.licitaciones[index_licitacion] //p.get_licitacion(index_licitacion)
    //l.cambia_estado(estado)
    l.estado=estado
  }

  @call({ payableFunction: true })
  evaluar_licitacion({ index_obra, index_licitacion, valoracion, justificacion, estado }:{ index_obra:number, index_licitacion:number, valoracion:number, justificacion:string, estado:number })  {
    //VALIDAR QUE CUENTAS PUEDEN EVALUAR y NO PERMITIR QUE SE EVALUE MAS DE UNA VEZ
    const sender = near.predecessorAccountId();
    const owner = this.proyectos[index_obra].sender
    const p:Proyecto = this.proyectos[index_obra]
    const l:Licitacion = p.licitaciones[index_licitacion] //p.get_licitacion(index_licitacion)

    assert(sender===owner,"Solo puede modificarlo el titular del contrato")
    assert(l.estado<=1,"Ya no esta disponible para evaluacion")
    l.valoracion=valoracion
    l.justificacion=justificacion
    l.estado=estado
    
    //assert(l.estado<=1,"Ya no esta disponible para evaluacion")
    //l.evalua(valoracion,justificacion,estado)
  }

  @view({ })
  get_arancel({}):string {
    return this.costo_participacion
  }

  @call({ payableFunction: true })
  modifica_arancel({ arancel }:{ arancel:string })  {
    const sender = near.predecessorAccountId();
    assert(sender===this.titular,"Solo puede modificarlo el titular de la dapp")
    //near.log(`Se modifico el arancel a: ${arancel}`);
    this.costo_participacion = arancel
  }

  @view({ })
  get_titular({}):string {
    return this.titular
  }

  @call({ payableFunction: true })
  modifica_titular({ titular }:{ titular:string })  {
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

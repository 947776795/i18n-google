 /**                                                                                                                                            
  * Nested Demo Page - 五层组件嵌套演示                                                                                                          
  */
 import { Level1 } from "@/components/nested/Level1";

                                                                                                                                             

                                                                                                                                                 
 export default function NestedDemoPage() {
    const a=`~${1}~`
    const b= '~dsdsdad~'
    return (
        <div className="nested-demo-page">      
        {a}
        {b}                                                                                                       
        ~<h1>Nested Components Demo</h1>                                                                                                               
        <p>This page demonstrates 5 levels of component nesting</p>sdsd~                                                                               
        <div>split</div>                                                                                                                               
        ~<h1>Nested Components Demo</h1>                                                                                                               
        <p>This page demonstrates 5 levels of component ~ nesting</p>sdsd~                                                                             
        <div>split</div>                                                                                                                               
        ~asd<h1>~Nested Components Demo~</h1>asda<span>dddd</span>~                                                                                      
        <div>split</div>                                                                                                                               
        ~<Level1 title='~11~' />d<div>ddd</div>~                                                                                                         
        </div>   
    )
 }
$(document).ready(function(){
    $("#btn").click(function(){
        /*
        var newPara =("<p></p>");
        $("#Chattext").appendChild(newPara).appendChild($("#askQ").val());     
        newPara.css({ "background-color":"white"});
        console.log(newPara);
        */

       var newPara =("<p></p>");
       
       $("#Chattext").append(newPara).append($("#askQ").val()).append(d.getFullYear());   
       
       
    });

    });

    
